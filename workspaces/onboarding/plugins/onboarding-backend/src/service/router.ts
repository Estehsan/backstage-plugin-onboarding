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
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import {
  HttpAuthService,
  LoggerService,
  PermissionsService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import {
  InputError,
  NotAllowedError,
  NotFoundError,
  NotImplementedError,
} from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { DatabaseOnboardingStore } from './OnboardingStore';
import { DatabaseTemplateDraftStore } from './TemplateDraftStore';
import { validateTemplate } from './templateValidation';
import { templateToYaml } from './templateYaml';
import { getBlockLibrary } from './blockLibrary';
import type { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';
import {
  assertUserAccess,
  getAssignerGroupRefs,
  getCallerGroupRefs,
  isMemberOfAssignerGroup,
} from './authz';
import {
  OnboardingProgress,
  OnboardingTask,
  OnboardingTemplate,
  Phase,
  PublishTemplateRequest,
  PublishTemplateResponse,
  ResourceType,
  TaskStatus,
  TaskType,
  TeamJoinerSummary,
  TemplateDraft,
} from '../types';
import {
  onboardingProgressReadPermission,
  onboardingProgressUpdatePermission,
  onboardingTeamReadPermission,
  onboardingTemplateAssignPermission,
  onboardingTemplateWritePermission,
} from '../permissions';

/** @public */
export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
  store: DatabaseOnboardingStore;
  draftStore: DatabaseTemplateDraftStore;
  /**
   * VCS provider for `POST /templates/:name/publish`. Injected via
   * `onboardingVcsExtensionPoint` (or passed directly). A real
   * techdocs-editor-node `VcsProvider` satisfies this interface, so it can be
   * registered with no adapter. When omitted, `POST /templates/:name/publish`
   * responds with 501 Not Implemented instead of crashing.
   */
  vcs?: OnboardingVcsProvider;
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

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Resolves a user entity ref from a request that identifies the user either
 * via separate `:kind/:namespace/:name` path segments, a combined
 * `:userId(*)` path segment, or a `?userId=` query parameter.
 *
 * Entity refs contain a `/` (e.g. `user:default/jdoe`), so embedding one in a
 * single URL path segment requires percent-encoding it (`%2F`). Some reverse
 * proxies and API gateways normalize or reject encoded slashes in a path
 * before the request ever reaches this service, which surfaces as a 404 that
 * looks like a routing bug but is actually happening upstream of Node. The
 * `kind/namespace/name` segment form sidesteps this entirely by never
 * putting a `/` inside a single segment — the same pattern the core catalog
 * backend uses for `/entities/by-name/:kind/:namespace/:name`. See the
 * "Proxy compatibility" section of this package's README.
 */
function resolveUserRefParam(req: express.Request): string | undefined {
  const { kind, namespace, name } = req.params;
  if (kind && namespace && name) {
    return stringifyEntityRef({
      kind: decodeParam(kind),
      namespace: decodeParam(namespace),
      name: decodeParam(name),
    });
  }
  const raw = req.params.userId ?? (req.query.userId as string | undefined);
  return raw ? decodeParam(raw) : undefined;
}

/** @public */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const {
    logger,
    config,
    store,
    draftStore,
    vcs,
    permissions,
    httpAuth,
    catalogApi,
  } = options;

  // Cache catalog template lookups to avoid thundering-herd of catalog queries
  // on every task update. Each createRouter() call gets its own isolated cache.
  const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  let cachedTemplates: OnboardingTemplate[] | null = null;
  let templateCacheExpiresAt = 0;
  async function getTemplatesCached(
    forceRefresh = false,
  ): Promise<OnboardingTemplate[]> {
    if (
      !forceRefresh &&
      cachedTemplates !== null &&
      Date.now() < templateCacheExpiresAt
    ) {
      return cachedTemplates;
    }
    const result = await getAllTemplates(catalogApi, config, logger);
    cachedTemplates = result;
    templateCacheExpiresAt = Date.now() + TEMPLATE_CACHE_TTL_MS;
    return result;
  }

  async function findTemplateByName(
    name: string,
  ): Promise<OnboardingTemplate | undefined> {
    const decodedName = decodeParam(name).trim();
    let templates = await getTemplatesCached();
    let template = templates.find(
      t =>
        t.metadata.name === decodedName ||
        t.metadata.name.toLowerCase() === decodedName.toLowerCase(),
    );

    if (!template) {
      // Force refresh cache in case the template was newly ingested or updated
      templates = await getTemplatesCached(true);
      template = templates.find(
        t =>
          t.metadata.name === decodedName ||
          t.metadata.name.toLowerCase() === decodedName.toLowerCase(),
      );
    }

    return template;
  }

  const router = Router();
  router.use(express.json());

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get(
    [
      '/progress',
      '/progress/by-ref/:kind/:namespace/:name',
      '/progress/:userId(*)',
    ],
    async (req, res) => {
      const userId = resolveUserRefParam(req);
      if (!userId) {
        throw new InputError('userId is required');
      }
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });

      await assertUserAccess({
        credentials,
        userId,
        permissions,
        ownerPermission: onboardingProgressReadPermission,
        elevatedPermission: onboardingTeamReadPermission,
      });

      // Spec 001 FR-002: return all of the user's progress records, not just one.
      let list = await store.listProgress(userId);

      if (list.length === 0) {
        const template = await findTemplateForUser(catalogApi, userId, logger);
        if (template) {
          // Spec 001 FR-003: seed via create-if-absent (idempotent) rather than
          // upsert, so a concurrent seed does not overwrite an existing row.
          const created = await store.createProgressIfAbsent(
            initializeProgress(userId, template),
          );
          list = [created];
        }
      }

      // Spec 001 FR-002 / SC-003: an empty roster is a 200 [] empty state (was 404). A
      // single-template user still gets exactly one element, preserving today's
      // behavior.
      res.status(200).json(list);
    },
  );

  router.post(
    [
      '/progress/by-ref/:kind/:namespace/:name/tasks/:taskId',
      '/progress/:userId(*)/tasks/:taskId',
    ],
    async (req, res) => {
      const userId = resolveUserRefParam(req);
      if (!userId) {
        throw new InputError('userId is required');
      }
      const taskId = decodeParam(req.params.taskId);
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });

      await assertUserAccess({
        credentials,
        userId,
        permissions,
        ownerPermission: onboardingProgressUpdatePermission,
        elevatedPermission: onboardingTeamReadPermission,
      });

      const { status, blockedReason, templateName } = req.body as {
        status?: TaskStatus;
        blockedReason?: string;
        templateName?: string;
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

      // Spec 001 FR-004: a task ID is only unique within its own template, so resolve
      // which template's record to update. Prefer an explicit templateName; fall back
      // to the sole template when the user has exactly one (SC-003 — old
      // single-template clients keep working without sending templateName).
      let targetTemplate = templateName?.trim();
      if (!targetTemplate) {
        const all = await store.listProgress(userId);
        if (all.length === 1) {
          targetTemplate = all[0].templateName;
        } else if (all.length === 0) {
          throw new NotFoundError(
            `No onboarding progress found for user ${userId}`,
          );
        } else {
          // Spec 001 FR-004: with >1 assigned template the request is ambiguous.
          throw new InputError(
            'templateName is required when the user has multiple assigned templates',
          );
        }
      }

      const progress = await store.getProgress(userId, targetTemplate);
      if (!progress) {
        throw new NotFoundError(
          `No onboarding progress found for user ${userId} and template ${targetTemplate}`,
        );
      }

      const taskIndex = progress.tasks.findIndex(t => t.taskId === taskId);
      if (taskIndex === -1) {
        throw new NotFoundError(`Task ${taskId} not found in progress`);
      }

      if (status === 'done') {
        const template = await findTemplateByName(progress.templateName);

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
    },
  );

  router.post(
    [
      '/progress/by-ref/:kind/:namespace/:name/buddy',
      '/progress/:userId(*)/buddy',
    ],
    async (req, res) => {
      const userId = resolveUserRefParam(req);
      if (!userId) {
        throw new InputError('userId is required');
      }
      const { buddyUserId: rawBuddyUserId } = req.body as {
        buddyUserId?: string | null;
      };
      const buddyUserId = rawBuddyUserId
        ? decodeParam(rawBuddyUserId)
        : rawBuddyUserId;
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });

      const decision = (
        await permissions.authorize(
          [{ permission: onboardingTemplateAssignPermission }],
          { credentials },
        )
      )[0];
      if (decision.result === AuthorizeResult.DENY) {
        throw new NotAllowedError('Not authorized to assign a buddy');
      }

      const callerRef = credentials.principal.userEntityRef;
      if (!(await isMemberOfAssignerGroup(catalogApi, callerRef, config))) {
        throw new NotAllowedError(
          'You are not a member of an authorized assigner group',
        );
      }

      const updated = await store.setBuddy(userId, buddyUserId ?? undefined);
      if (!updated) {
        throw new NotFoundError(`No onboarding progress found for ${userId}`);
      }
      res.status(200).json({ userId, buddyUserId: buddyUserId ?? undefined });
    },
  );

  router.get('/teams/mine', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const callerRef = credentials.principal.userEntityRef;
    const assignerGroups = getAssignerGroupRefs(config);
    if (assignerGroups.size === 0) {
      res.status(200).json({ teams: [] });
      return;
    }
    const callerGroups = await getCallerGroupRefs(catalogApi, callerRef);
    const teams = [...callerGroups]
      .filter(group => assignerGroups.has(group))
      .map(group => parseEntityRef(group).name)
      .sort();
    res.status(200).json({ teams });
  });

  router.get('/assigner/me', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const callerRef = credentials.principal.userEntityRef;
    const decision = (
      await permissions.authorize(
        [{ permission: onboardingTemplateAssignPermission }],
        { credentials },
      )
    )[0];
    const hasPermission = decision.result === AuthorizeResult.ALLOW;
    const isGroupMember = hasPermission
      ? await isMemberOfAssignerGroup(catalogApi, callerRef, config)
      : false;
    res.status(200).json({ isAssigner: hasPermission && isGroupMember });
  });

  router.get('/buddies/mine', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const callerRef = credentials.principal.userEntityRef;
    const progressList = await store.getBuddyProgress(callerRef);
    const displayNames = await getDisplayNamesByRef(catalogApi, [
      ...collectJoinerAndBuddyRefs(progressList),
    ]);
    res.status(200).json(toJoinerSummaries(progressList, displayNames));
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

    // Check caller is a member of the team's group
    const callerRef = credentials.principal.userEntityRef;
    const callerGroups = await getCallerGroupRefs(catalogApi, callerRef);
    if (!callerGroups.has(`group:default/${teamName}`)) {
      throw new NotAllowedError(`Not a member of team ${teamName}`);
    }

    // Restrict full team roster visibility to configured assigner groups
    // (backward compatible: no restriction when assignerGroups is unset).
    const assignerGroups = getAssignerGroupRefs(config);
    if (
      assignerGroups.size > 0 &&
      !assignerGroups.has(`group:default/${teamName}`)
    ) {
      throw new NotAllowedError(
        'Team stats restricted to configured assigner groups',
      );
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

    const userIds = teamMembers.items.map(
      e => `user:default/${e.metadata.name}`,
    );
    const allProgress = await store.getTeamProgress(userIds);

    const filteredProgress = allProgress.filter(p => {
      const started = new Date(p.startDate);
      const donePercent =
        p.tasks.length > 0
          ? p.tasks.filter(t => t.status === 'done').length / p.tasks.length
          : 0;
      return started >= cutoffDate && donePercent < 1;
    });

    const displayNames = await getDisplayNamesByRef(catalogApi, [
      ...collectJoinerAndBuddyRefs(filteredProgress),
    ]);
    const activeJoiners = toJoinerSummaries(filteredProgress, displayNames);

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

    const callerRef = credentials.principal.userEntityRef;
    if (!(await isMemberOfAssignerGroup(catalogApi, callerRef, config))) {
      throw new NotAllowedError(
        'You are not a member of an authorized assigner group',
      );
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

  const handleAssign = async (req: express.Request, res: express.Response) => {
    const templateName = decodeParam(req.params.templateName);
    const body = req.body as
      | { userId?: string; buddyUserId?: string }
      | undefined;
    const userId = body?.userId
      ? decodeParam(body.userId)
      : resolveUserRefParam(req);
    if (!userId) {
      throw new InputError('userId is required');
    }
    const buddyUserId = body?.buddyUserId
      ? decodeParam(body.buddyUserId)
      : undefined;
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

    const callerRef = credentials.principal.userEntityRef;
    if (!(await isMemberOfAssignerGroup(catalogApi, callerRef, config))) {
      throw new NotAllowedError(
        'You are not a member of an authorized assigner group',
      );
    }

    const template = await findTemplateByName(templateName);

    if (!template) {
      throw new NotFoundError(`Template ${templateName} not found`);
    }

    const resolvedUserRef = await assertCatalogUserExists(catalogApi, userId);

    validateTemplateDependencies(template);

    // Spec 001 FR-003 / User Story 2 (P2): create a new record for (user, template) if
    // absent; must NOT modify or delete the user's other templates. Re-assigning the
    // same template returns the existing record unchanged (SC-002).
    const progress = await store.createProgressIfAbsent(
      initializeProgress(resolvedUserRef, template),
    );

    if (buddyUserId) {
      const resolvedBuddyRef = await assertCatalogUserExists(
        catalogApi,
        buddyUserId,
      );
      await store.setBuddy(resolvedUserRef, resolvedBuddyRef);
      progress.buddyUserId = resolvedBuddyRef;
    }

    logger.info(`Assigned template ${templateName} to user ${resolvedUserRef}`);
    res.status(200).json(progress);
  };

  router.post('/templates/:templateName/assign', handleAssign);
  router.post(
    '/templates/:templateName/assign/by-ref/:kind/:namespace/:name',
    handleAssign,
  );
  router.post('/templates/:templateName/assign/:userId(*)', handleAssign);

  async function authorizeTemplateWrite(req: express.Request) {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const decision = (
      await permissions.authorize(
        [{ permission: onboardingTemplateWritePermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }
    return credentials;
  }

  router.get('/blocks', async (req, res) => {
    await authorizeTemplateWrite(req);
    res.status(200).json(getBlockLibrary(config));
  });

  router.get('/templates/:name/draft', async (req, res) => {
    await authorizeTemplateWrite(req);
    const { name } = req.params;

    const existing = await draftStore.getDraft(name);
    if (existing) {
      res.status(200).json(existing);
      return;
    }

    const template = await findTemplateByName(name);
    if (!template) {
      throw new NotFoundError(`Template ${name} not found`);
    }

    const sourceLocation = await findTemplateLocation(catalogApi, name, logger);
    const draft: TemplateDraft = {
      name,
      template,
      sourceLocation,
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };
    res.status(200).json(draft);
  });

  router.put('/templates/:name/draft', async (req, res) => {
    const credentials = await authorizeTemplateWrite(req);
    const { name } = req.params;
    const { template, sourceLocation } = req.body as {
      template?: OnboardingTemplate;
      sourceLocation?: string;
    };
    if (!template) {
      throw new InputError('template is required');
    }

    const issues = validateTemplate(template);
    if (issues.some(i => i.severity === 'error')) {
      res.status(400).json({ issues });
      return;
    }

    const existing = await draftStore.getDraft(name);
    const draft: TemplateDraft = {
      name,
      template,
      sourceLocation: sourceLocation ?? existing?.sourceLocation,
      updatedBy: credentials.principal.userEntityRef,
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };
    await draftStore.upsertDraft(draft);
    res.status(200).json(draft);
  });

  router.post('/templates', async (req, res) => {
    const credentials = await authorizeTemplateWrite(req);
    const { name, role, title } = req.body as {
      name?: string;
      role?: string;
      title?: string;
    };
    if (!name || !role) {
      throw new InputError('name and role are required');
    }

    const draft: TemplateDraft = {
      name,
      template: {
        apiVersion: 'onboarding.backstage.io/v1',
        kind: 'OnboardingTemplate',
        metadata: { name, title: title ?? name },
        spec: { role, phases: [] },
      },
      updatedBy: credentials.principal.userEntityRef,
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };
    await draftStore.upsertDraft(draft);
    res.status(201).json(draft);
  });

  router.post('/templates/:name/validate', async (req, res) => {
    await authorizeTemplateWrite(req);
    const { template } = req.body as { template?: OnboardingTemplate };
    if (!template) {
      throw new InputError('template is required');
    }
    res.status(200).json(validateTemplate(template));
  });

  router.post('/templates/:name/publish', async (req, res) => {
    const credentials = await authorizeTemplateWrite(req);
    const { name } = req.params;
    const body = req.body as PublishTemplateRequest;

    const draft = await draftStore.getDraft(name);
    if (!draft) {
      throw new NotFoundError(`No draft found for template ${name}`);
    }

    const issues = validateTemplate(draft.template);
    if (issues.some(i => i.severity === 'error')) {
      res.status(400).json({ issues });
      return;
    }

    if (!vcs) {
      throw new NotImplementedError(
        'VCS provider is not configured for template publishing',
      );
    }

    const target = resolvePublishTarget(body, draft.sourceLocation);
    const baseBranch =
      body.baseBranch ?? (await vcs.getDefaultBranch(target.repoUrl));
    const authorRef = credentials.principal.userEntityRef;
    const authorName = authorRef ? parseEntityRef(authorRef).name : 'backstage';

    const result = await vcs.openPullRequest({
      repoUrl: target.repoUrl,
      headBranch: `onboarding/template-${name}-${Date.now()}`,
      baseBranch,
      title: body.title,
      description: body.description,
      files: new Map([
        [
          target.filePath,
          { content: templateToYaml(draft.template), encoding: 'utf8' },
        ],
      ]),
      commitMessage: body.commitMessage ?? body.title,
      authorName,
      authorEmail: `${authorName}@users.noreply.github.com`,
      draft: body.draft,
      reviewers: body.reviewers,
    });

    await draftStore.markPublished(name);
    const response: PublishTemplateResponse = {
      url: result.url,
      number: result.number,
    };
    res.status(200).json(response);
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

/**
 * Collects the deduplicated set of user entity refs (joiners plus any
 * assigned buddies) that display names need to be resolved for, so that
 * buddy display names actually resolve instead of always falling back to
 * "\u2014" when the buddy isn't otherwise in the joiner list.
 */
function collectJoinerAndBuddyRefs(
  progressList: OnboardingProgress[],
): Set<string> {
  const refs = new Set<string>();
  for (const progress of progressList) {
    refs.add(progress.userId);
    if (progress.buddyUserId) {
      refs.add(progress.buddyUserId);
    }
  }
  return refs;
}

async function getDisplayNamesByRef(
  catalogApi: CatalogApi,
  refs: string[],
): Promise<Map<string, string>> {
  if (refs.length === 0) {
    return new Map();
  }
  const { items } = await catalogApi.getEntitiesByRefs({
    entityRefs: refs,
    fields: ['metadata.name', 'spec.profile.displayName'],
  });
  const result = new Map<string, string>();
  refs.forEach((ref, index) => {
    const entity = items[index];
    const displayName =
      (entity?.spec as { profile?: { displayName?: string } } | undefined)
        ?.profile?.displayName ??
      entity?.metadata.name ??
      ref;
    result.set(ref, displayName);
  });
  return result;
}

function toJoinerSummaries(
  progressList: OnboardingProgress[],
  displayNames: Map<string, string>,
): TeamJoinerSummary[] {
  return progressList.map(progress => {
    const doneTasks = progress.tasks.filter(t => t.status === 'done').length;
    const blockedTasks = progress.tasks.filter(
      t => t.status === 'blocked',
    ).length;
    return {
      userId: progress.userId,
      displayName: displayNames.get(progress.userId) ?? progress.userId,
      role: progress.templateName,
      // Spec 001 FR-006: emit one summary per (user, template); templateName keeps
      // otherwise-identical userId roster rows distinct.
      templateName: progress.templateName,
      startDate: progress.startDate,
      completionPercent:
        progress.tasks.length === 0
          ? 0
          : Math.round((doneTasks / progress.tasks.length) * 100),
      blockedTaskCount: blockedTasks,
      buddyUserId: progress.buddyUserId,
      buddyDisplayName: progress.buddyUserId
        ? displayNames.get(progress.buddyUserId)
        : undefined,
    };
  });
}

async function assertCatalogUserExists(
  catalogApi: CatalogApi,
  userId: string,
): Promise<string> {
  const normalizedUserId = decodeParam(userId).trim();
  let entityRef: string;
  try {
    const parsed = parseEntityRef(normalizedUserId, {
      defaultKind: 'User',
      defaultNamespace: 'default',
    });
    entityRef = stringifyEntityRef(parsed);
  } catch {
    entityRef = normalizedUserId;
  }

  const entity = await catalogApi.getEntityByRef(entityRef);
  if (entity && entity.kind?.toLowerCase() === 'user') {
    return stringifyEntityRef(entity);
  }

  // Fallback: search by name or email in catalog in case userId was provided as an email or alias
  try {
    const allUsers = await catalogApi.getEntities({
      filter: { kind: 'User' },
      fields: [
        'kind',
        'metadata.name',
        'metadata.namespace',
        'spec.profile.email',
      ],
      limit: MAX_CATALOG_USERS,
    });
    const lower = normalizedUserId.toLowerCase();
    const matched = allUsers.items.find(u => {
      const name = u.metadata.name?.toLowerCase();
      const spec = u.spec as Record<string, unknown> | undefined;
      const profile = spec?.profile as Record<string, unknown> | undefined;
      const email = ((profile?.email as string) ?? '').toLowerCase();
      return (
        name === lower ||
        email === lower ||
        stringifyEntityRef(u).toLowerCase() === lower
      );
    });
    if (matched) {
      return stringifyEntityRef(matched);
    }
  } catch {
    // ignore search failure, fall through to error
  }

  throw new InputError(`User ${userId} was not found in the catalog`);
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

/**
 * Reads the `backstage.io/managed-by-location` annotation for an
 * OnboardingTemplate so a publish can target its original file.
 */
async function findTemplateLocation(
  catalogApi: CatalogApi,
  name: string,
  logger: LoggerService,
): Promise<string | undefined> {
  try {
    const entities = await catalogApi.getEntities({
      filter: { kind: 'OnboardingTemplate', 'metadata.name': name },
      fields: ['metadata.annotations'],
      limit: 1,
    });
    return entities.items[0]?.metadata?.annotations?.[
      'backstage.io/managed-by-location'
    ];
  } catch (error) {
    logger.warn(`Failed to read location for template ${name}`, {
      error: String(error),
    });
    return undefined;
  }
}

/**
 * Parses a catalog `url:` location into a repository URL and file path,
 * supporting GitHub (`/blob/`) and GitLab (`/-/blob/`) style URLs.
 */
export function parseSourceLocation(
  location: string,
): { repoUrl: string; filePath: string } | undefined {
  const raw = location.startsWith('url:')
    ? location.slice('url:'.length)
    : location;
  const match = raw.match(
    /^(https?:\/\/[^/]+\/[^/]+\/[^/]+)\/(?:-\/)?(?:blob|tree)\/[^/]+\/(.+)$/,
  );
  if (!match) {
    return undefined;
  }
  return { repoUrl: match[1], filePath: match[2] };
}

/**
 * Resolves the repository URL and file path a publish should target, from the
 * explicit request body or the draft's captured source location.
 */
function resolvePublishTarget(
  body: PublishTemplateRequest,
  sourceLocation: string | undefined,
): { repoUrl: string; filePath: string } {
  if (body.repoUrl && body.filePath) {
    return { repoUrl: body.repoUrl, filePath: body.filePath };
  }
  if (sourceLocation) {
    const parsed = parseSourceLocation(sourceLocation);
    if (parsed) {
      return {
        repoUrl: body.repoUrl ?? parsed.repoUrl,
        filePath: body.filePath ?? parsed.filePath,
      };
    }
  }
  throw new InputError(
    'repoUrl and filePath are required to publish this template',
  );
}
