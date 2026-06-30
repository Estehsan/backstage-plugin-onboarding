/*
 * Copyright 2026 Estehsan Tariq
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import express from 'express';
import Router from 'express-promise-router';
import { stringifyEntityRef } from '@backstage/catalog-model';
import {
  BackstageCredentials,
  BackstageUserPrincipal,
  HttpAuthService,
  LoggerService,
  PermissionsService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import {
  AuthorizeResult,
  BasicPermission,
} from '@backstage/plugin-permission-common';
import { DatabaseOnboardingStore } from './OnboardingStore';
import {
  OnboardingProgress,
  OnboardingTask,
  OnboardingTemplate,
  Phase,
  ResourceType,
  TaskStatus,
  TaskType,
} from '../types';
import {
  onboardingProgressReadPermission,
  onboardingProgressUpdatePermission,
  onboardingTeamReadPermission,
  onboardingTemplateAssignPermission,
} from '../permissions';

/** @public */
export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
  store: DatabaseOnboardingStore;
  permissions: PermissionsService;
  httpAuth: HttpAuthService;
  catalogApi: CatalogApi;
}

const VALID_STATUSES: TaskStatus[] = [
  'pending',
  'in-progress',
  'done',
  'blocked',
];

const VALID_PHASES = new Set<Phase>(['day1', 'week1', 'week2', 'month1']);

const MAX_USER_SEARCH_RESULTS = 50;

function getActiveJoinerWindowDays(config: RootConfigService): number {
  return (
    config.getOptionalNumber('onboarding.defaults.activeJoinerWindowDays') ?? 90
  );
}

/**
 * Maximum number of catalog rows to request for queries that could otherwise
 * return an unbounded result set, to protect the backend from memory/DoS
 * pressure when the catalog is large.
 */
const MAX_CATALOG_USERS = 1000;
const MAX_CATALOG_TEMPLATES = 1000;

/**
 * Returns true when the authenticated caller is the same user as the `userId`
 * route parameter. Backstage user refs may be supplied either as a full entity
 * ref (e.g. `user:default/alice`) or as a short name (e.g. `alice`); both forms
 * are compared case-insensitively, and as a fallback the trailing name portion
 * of each ref is compared so that the two forms resolve to the same user.
 */
function isSameUser(callerRef: string, userId: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase();
  const namePart = (value: string) => {
    const normalized = normalize(value);
    const slashIndex = normalized.lastIndexOf('/');
    return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  };

  const caller = normalize(callerRef);
  const target = normalize(userId);
  return caller === target || namePart(caller) === namePart(target);
}

/**
 * Authorizes access to a user-scoped onboarding resource using an
 * "ownership + role bypass" model:
 *
 * - If the caller owns the resource (the authenticated user ref matches the
 *   `userId` parameter), the caller's own `ownerPermission` is evaluated. This
 *   lets users read/update their own onboarding data.
 * - If the caller does NOT own the resource, the `elevatedPermission` is
 *   evaluated instead. This is the manager/buddy/admin gate that allows trusted
 *   roles to access other users' onboarding data.
 *
 * In either branch a DENY decision results in a {@link NotAllowedError}. This
 * prevents the IDOR class of bug where an allow-all policy would otherwise let
 * any authenticated user read or mutate another user's progress.
 */
async function assertUserAccess(opts: {
  credentials: BackstageCredentials<BackstageUserPrincipal>;
  userId: string;
  permissions: PermissionsService;
  ownerPermission: BasicPermission;
  elevatedPermission: BasicPermission;
}): Promise<void> {
  const {
    credentials,
    userId,
    permissions,
    ownerPermission,
    elevatedPermission,
  } = opts;

  const callerRef = credentials.principal.userEntityRef;
  const owner = isSameUser(callerRef, userId);
  const permission = owner ? ownerPermission : elevatedPermission;

  const decision = (
    await permissions.authorize([{ permission }], { credentials })
  )[0];

  if (decision.result === AuthorizeResult.DENY) {
    throw new NotAllowedError(
      owner
        ? 'Unauthorized'
        : 'You are not allowed to access another user\u2019s onboarding progress',
    );
  }
}

/** @public */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config, store, permissions, httpAuth, catalogApi } = options;

  // Cache catalog template lookups to avoid thundering-herd of catalog queries
  // on every task update. Each createRouter() call gets its own isolated cache.
  const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  let cachedTemplates: OnboardingTemplate[] | null = null;
  let templateCacheExpiresAt = 0;
  async function getTemplatesCached(): Promise<OnboardingTemplate[]> {
    if (cachedTemplates !== null && Date.now() < templateCacheExpiresAt) {
      return cachedTemplates;
    }
    const result = await getAllTemplates(catalogApi, config, logger);
    cachedTemplates = result;
    templateCacheExpiresAt = Date.now() + TEMPLATE_CACHE_TTL_MS;
    return result;
  }

  const router = Router();
  router.use(express.json());

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/progress/:userId', async (req, res) => {
    const { userId } = req.params;
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    await assertUserAccess({
      credentials,
      userId,
      permissions,
      ownerPermission: onboardingProgressReadPermission,
      elevatedPermission: onboardingTeamReadPermission,
    });

    let progress = await store.getProgress(userId);

    if (!progress) {
      const template = await findTemplateForUser(catalogApi, userId, logger);
      if (template) {
        progress = initializeProgress(userId, template);
        await store.upsertProgress(progress);
      }
    }

    if (!progress) {
      throw new NotFoundError(
        `No onboarding progress found for user ${userId}`,
      );
    }

    res.status(200).json(progress);
  });

  router.post('/progress/:userId/tasks/:taskId', async (req, res) => {
    const { userId, taskId } = req.params;
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    await assertUserAccess({
      credentials,
      userId,
      permissions,
      ownerPermission: onboardingProgressUpdatePermission,
      elevatedPermission: onboardingTeamReadPermission,
    });

    const { status, blockedReason } = req.body as {
      status?: TaskStatus;
      blockedReason?: string;
    };

    if (!status || !VALID_STATUSES.includes(status)) {
      throw new InputError(
        `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(
          ', ',
        )}`,
      );
    }

    if (blockedReason !== undefined && blockedReason.length > 500) {
      throw new InputError('blockedReason must not exceed 500 characters');
    }

    const progress = await store.getProgress(userId);
    if (!progress) {
      throw new NotFoundError(
        `No onboarding progress found for user ${userId}`,
      );
    }

    const taskIndex = progress.tasks.findIndex(t => t.taskId === taskId);
    if (taskIndex === -1) {
      throw new NotFoundError(`Task ${taskId} not found in progress`);
    }

    if (status === 'done') {
      const templates = await getTemplatesCached();
      const template = templates.find(
        t => t.metadata.name === progress.templateName,
      );

      if (template) {
        const allTasks = template.spec.phases.flatMap(p => p.tasks);
        const currentTask = allTasks.find(t => t.id === taskId);

        if (currentTask?.dependsOn && currentTask.dependsOn.length > 0) {
          const unmetDeps = currentTask.dependsOn.filter(depId => {
            const depProgress = progress.tasks.find(t => t.taskId === depId);
            return !depProgress || depProgress.status !== 'done';
          });

          if (unmetDeps.length > 0) {
            throw new InputError(
              `Cannot mark task ${taskId} as done. Unmet dependencies: ${unmetDeps.join(
                ', ',
              )}`,
            );
          }
        }
      }
    }

    progress.tasks[taskIndex] = {
      ...progress.tasks[taskIndex],
      status,
      completedAt: status === 'done' ? new Date().toISOString() : undefined,
      blockedReason: status === 'blocked' ? blockedReason : undefined,
    };

    await store.upsertProgress(progress);
    logger.info(`Updated task ${taskId} for user ${userId} to ${status}`);

    res.status(200).json(progress);
  });

  router.get('/team/:teamName/stats', async (req, res) => {
    const { teamName } = req.params;
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    const decision = (
      await permissions.authorize(
        [{ permission: onboardingTeamReadPermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const windowDays = getActiveJoinerWindowDays(config);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    const teamMembers = await catalogApi.getEntities({
      filter: {
        kind: 'User',
        'relations.memberOf': `group:default/${teamName}`,
      },
      fields: [
        'kind',
        'metadata.name',
        'spec.profile.displayName',
        'relations',
      ],
      limit: MAX_CATALOG_USERS,
    });

    // Index members by their user ref once so the active-joiner mapping below is
    // O(n) rather than O(n^2) via repeated Array.find lookups.
    const membersByRef = new Map(
      teamMembers.items.map(e => [`user:default/${e.metadata.name}`, e]),
    );

    const userIds = teamMembers.items.map(
      e => `user:default/${e.metadata.name}`,
    );
    const allProgress = await store.getTeamProgress(userIds);

    const activeJoiners = allProgress
      .filter(p => {
        const started = new Date(p.startDate);
        const donePercent =
          p.tasks.length > 0
            ? p.tasks.filter(t => t.status === 'done').length / p.tasks.length
            : 0;
        return started >= cutoffDate && donePercent < 1;
      })
      .map(p => {
        const member = membersByRef.get(p.userId);
        const doneTasks = p.tasks.filter(t => t.status === 'done').length;
        const blockedTasks = p.tasks.filter(t => t.status === 'blocked').length;
        const completionPercent =
          p.tasks.length > 0
            ? Math.round((doneTasks / p.tasks.length) * 100)
            : 0;

        return {
          userId: p.userId,
          displayName: getEntityDisplayName(member, p.userId),
          role: p.templateName,
          startDate: p.startDate,
          completionPercent,
          blockedTaskCount: blockedTasks,
        };
      });

    const avgCompletionPercent =
      activeJoiners.length > 0
        ? Math.round(
            activeJoiners.reduce((sum, j) => sum + j.completionPercent, 0) /
              activeJoiners.length,
          )
        : 0;

    const totalBlockedTasks = activeJoiners.reduce(
      (sum, j) => sum + j.blockedTaskCount,
      0,
    );

    res.status(200).json({
      teamName,
      activeJoiners,
      avgCompletionPercent,
      totalBlockedTasks,
    });
  });

  router.get('/templates', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    const decision = (
      await permissions.authorize(
        [{ permission: onboardingProgressReadPermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const templates = await getTemplatesCached();
    res.status(200).json(templates);
  });

  router.get('/users/search', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    const decision = (
      await permissions.authorize(
        [{ permission: onboardingTemplateAssignPermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const query = String(req.query.query ?? '').trim();

    if (query.length > 100) {
      throw new InputError('Search query must not exceed 100 characters');
    }

    // Read all User entities (capped) and filter in memory rather than relying
    // on the catalog full-text index, which may be unpopulated or stale and
    // would otherwise cause matching users to be silently missed. An empty
    // query lists users so the assign picker can be browsed without typing.
    const allUsers = await catalogApi.getEntities({
      filter: { kind: 'User' },
      fields: [
        'kind',
        'metadata.name',
        'metadata.namespace',
        'metadata.title',
        'spec.profile.displayName',
        'spec.profile.email',
      ],
      limit: MAX_CATALOG_USERS,
    });

    const lowerQuery = query.toLowerCase();
    const matched = query
      ? allUsers.items.filter(entity => {
          const name = entity.metadata.name?.toLowerCase() ?? '';
          const title = (entity.metadata.title ?? '').toLowerCase();
          const spec = entity.spec as Record<string, unknown> | undefined;
          const profile = spec?.profile as Record<string, unknown> | undefined;
          const displayName = (
            (profile?.displayName as string) ?? ''
          ).toLowerCase();
          const email = ((profile?.email as string) ?? '').toLowerCase();
          return (
            name.includes(lowerQuery) ||
            title.includes(lowerQuery) ||
            displayName.includes(lowerQuery) ||
            email.includes(lowerQuery)
          );
        })
      : allUsers.items;

    const results = matched
      .map(entity => ({
        entityRef: stringifyEntityRef(entity),
        displayName: getEntityDisplayName(entity, entity.metadata.name),
        email: getEntityEmail(entity),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, MAX_USER_SEARCH_RESULTS);

    res.status(200).json(results);
  });

  router.post('/templates/:templateName/assign/:userId', async (req, res) => {
    const { templateName, userId } = req.params;
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    const decision = (
      await permissions.authorize(
        [{ permission: onboardingTemplateAssignPermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const templates = await getTemplatesCached();
    const template = templates.find(t => t.metadata.name === templateName);

    if (!template) {
      throw new NotFoundError(`Template ${templateName} not found`);
    }

    await assertCatalogUserExists(catalogApi, userId);

    validateTemplateDependencies(template);

    const progress = initializeProgress(userId, template);
    await store.upsertProgress(progress);

    logger.info(`Assigned template ${templateName} to user ${userId}`);
    res.status(200).json(progress);
  });

  return router;
}

function getEntityDisplayName(
  entity: { spec?: unknown } | undefined,
  fallback: string,
): string {
  const spec = entity?.spec as Record<string, unknown> | undefined;
  const profile = spec?.profile as Record<string, unknown> | undefined;
  return (profile?.displayName as string) ?? fallback;
}

function getEntityEmail(entity: { spec?: unknown }): string | undefined {
  const spec = entity.spec as Record<string, unknown> | undefined;
  const profile = spec?.profile as Record<string, unknown> | undefined;
  return profile?.email as string | undefined;
}

async function assertCatalogUserExists(
  catalogApi: CatalogApi,
  userId: string,
): Promise<void> {
  const entity = await catalogApi.getEntityByRef(userId);
  if (!entity || entity.kind !== 'User') {
    throw new InputError(`User ${userId} was not found in the catalog`);
  }
}

function initializeProgress(
  userId: string,
  template: OnboardingTemplate,
): OnboardingProgress {
  const tasks = template.spec.phases.flatMap(phase =>
    phase.tasks.map(task => ({
      taskId: task.id,
      status: 'pending' as TaskStatus,
    })),
  );

  return {
    userId,
    templateName: template.metadata.name,
    startDate: new Date().toISOString(),
    tasks,
  };
}

/**
 * Validates that all dependsOn references point to existing tasks and that
 * there are no circular dependencies. Throws InputError on violation.
 */
function validateTemplateDependencies(template: OnboardingTemplate): void {
  const allTasks = template.spec.phases.flatMap(p => p.tasks);
  const allTaskIds = new Set(allTasks.map(t => t.id));

  // Check all dependency IDs exist
  for (const task of allTasks) {
    for (const depId of task.dependsOn ?? []) {
      if (!allTaskIds.has(depId)) {
        throw new InputError(
          `Template "${template.metadata.name}": task "${task.id}" depends on unknown task "${depId}"`,
        );
      }
    }
  }

  // Detect cycles with DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function detectCycle(taskId: string): boolean {
    if (inStack.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visited.add(taskId);
    inStack.add(taskId);
    const task = allTasks.find(t => t.id === taskId);
    for (const depId of task?.dependsOn ?? []) {
      if (detectCycle(depId)) return true;
    }
    inStack.delete(taskId);
    return false;
  }

  for (const task of allTasks) {
    if (detectCycle(task.id)) {
      throw new InputError(
        `Template "${template.metadata.name}" has a circular dependency involving task "${task.id}"`,
      );
    }
  }
}

async function findTemplateForUser(
  catalogApi: CatalogApi,
  userId: string,
  logger: LoggerService,
): Promise<OnboardingTemplate | undefined> {
  try {
    const userEntity = await catalogApi.getEntityByRef(userId);
    if (!userEntity) {
      return undefined;
    }

    const spec = userEntity.spec as Record<string, unknown> | undefined;
    const profile = spec?.profile as Record<string, unknown> | undefined;
    const role = profile?.role as string | undefined;

    if (!role) {
      return undefined;
    }

    const templateEntities = await catalogApi.getEntities({
      filter: {
        kind: 'OnboardingTemplate',
      },
      limit: MAX_CATALOG_TEMPLATES,
    });

    for (const entity of templateEntities.items) {
      const templateSpec = entity.spec as Record<string, unknown> | undefined;
      if (templateSpec?.role === role) {
        return entityToTemplate(entity);
      }
    }

    return undefined;
  } catch (error) {
    logger.warn(`Failed to find template for user ${userId}`, {
      error: String(error),
    });
    return undefined;
  }
}

async function getAllTemplates(
  catalogApi: CatalogApi,
  config: RootConfigService,
  logger: LoggerService,
): Promise<OnboardingTemplate[]> {
  try {
    const entities = await catalogApi.getEntities({
      filter: {
        kind: 'OnboardingTemplate',
      },
      limit: MAX_CATALOG_TEMPLATES,
    });

    if (entities.items.length > 0) {
      return entities.items.map(entity => entityToTemplate(entity));
    }
  } catch (error) {
    logger.warn('Failed to fetch onboarding templates from catalog', {
      error: String(error),
    });
  }

  // Fallback: read templates from config when catalog has none
  return getTemplatesFromConfig(config);
}

function getTemplatesFromConfig(
  config: RootConfigService,
): OnboardingTemplate[] {
  const defaults = config.getOptionalConfigArray(
    'onboarding.templates.defaults',
  );
  if (!defaults) {
    return [];
  }

  return defaults.map(tpl => {
    const name = tpl.getString('name');
    const title = tpl.getOptionalString('title') ?? name;
    const description = tpl.getOptionalString('description');
    const phases = tpl.getOptionalStringArray('phases') ?? [];
    const taskConfigs = tpl.getOptionalConfigArray('tasks') ?? [];

    const phaseMap = new Map<string, OnboardingTask[]>();
    for (const phase of phases) {
      if (!VALID_PHASES.has(phase as Phase)) {
        throw new Error(
          `onboarding.templates.defaults: invalid phase "${phase}" in template "${name}". Must be one of: ${[
            ...VALID_PHASES,
          ].join(', ')}`,
        );
      }
      phaseMap.set(phase, []);
    }

    for (const taskCfg of taskConfigs) {
      const phase = taskCfg.getString('phase');
      if (!VALID_PHASES.has(phase as Phase)) {
        throw new Error(
          `onboarding.templates.defaults: invalid phase "${phase}" for task "${taskCfg.getString(
            'id',
          )}" in template "${name}". Must be one of: ${[...VALID_PHASES].join(
            ', ',
          )}`,
        );
      }

      const resourceConfigs = taskCfg.getOptionalConfigArray('resources');
      const resources = resourceConfigs?.map(r => ({
        type: r.getString('type') as ResourceType,
        title: r.getString('title'),
        url: r.getString('url'),
        duration: r.getOptionalString('duration'),
      }));

      const task: OnboardingTask = {
        id: taskCfg.getString('id'),
        phase: phase as Phase,
        title: taskCfg.getString('title'),
        description: taskCfg.getOptionalString('description') ?? '',
        type: (taskCfg.getOptionalString('type') as TaskType) ?? 'manual',
        assignee: taskCfg.getOptionalString('assignee') ?? 'self',
        dependsOn: taskCfg.getOptionalStringArray('dependsOn'),
        duePhase: (taskCfg.getOptionalString('duePhase') ?? phase) as Phase,
        estimatedMinutes: taskCfg.getOptionalNumber('estimatedMinutes'),
        documentation: taskCfg.getOptionalString('documentation'),
        resources,
        recommendations: taskCfg.getOptionalStringArray('recommendations'),
      };
      const list = phaseMap.get(phase);
      if (list) {
        list.push(task);
      } else {
        phaseMap.set(phase, [task]);
      }
    }

    return {
      apiVersion: 'onboarding.backstage.io/v1' as const,
      kind: 'OnboardingTemplate' as const,
      metadata: { name, title, description },
      spec: {
        role: '',
        phases: [...phaseMap.entries()].map(([id, tasks]) => ({
          id: id as Phase,
          tasks,
        })),
      },
    };
  });
}

function entityToTemplate(entity: {
  metadata: { name: string; title?: string; description?: string };
  spec?: Record<string, unknown> | unknown;
}): OnboardingTemplate {
  const spec = entity.spec as Record<string, unknown>;
  return {
    apiVersion: 'onboarding.backstage.io/v1',
    kind: 'OnboardingTemplate',
    metadata: {
      name: entity.metadata.name,
      title: entity.metadata.title ?? entity.metadata.name,
      description: entity.metadata.description,
    },
    spec: {
      role: (spec?.role as string) ?? '',
      team: spec?.team as string | undefined,
      phases: (spec?.phases as OnboardingTemplate['spec']['phases']) ?? [],
    },
  };
}
