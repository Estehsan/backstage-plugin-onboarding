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

import { RELATION_MEMBER_OF } from '@backstage/catalog-model';
import { CatalogApi } from '@backstage/catalog-client';
import {
  BackstageCredentials,
  BackstageUserPrincipal,
  PermissionsService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { NotAllowedError } from '@backstage/errors';
import {
  AuthorizeResult,
  BasicPermission,
} from '@backstage/plugin-permission-common';

/**
 * Returns true when the authenticated caller is the same user as the `userId`
 * route parameter. Backstage user refs may be supplied either as a full entity
 * ref (e.g. `user:default/alice`) or as a short name (e.g. `alice`); both forms
 * are compared case-insensitively, and as a fallback the trailing name portion
 * of each ref is compared so that the two forms resolve to the same user.
 */
export function isSameUser(callerRef: string, userId: string): boolean {
  const normalize = (value: string) => {
    try {
      return decodeURIComponent(value).trim().toLowerCase();
    } catch {
      return value.trim().toLowerCase();
    }
  };
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
export async function assertUserAccess(opts: {
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

/**
 * Reads `onboarding.defaults.assignerGroups` from config and returns the
 * corresponding set of catalog group entity refs. Bare group names (no `:`)
 * are assumed to live in the `default` namespace. Returns an empty set when
 * unset, meaning "no restriction" to callers of {@link isMemberOfAssignerGroup}.
 */
export function getAssignerGroupRefs(config: RootConfigService): Set<string> {
  const names = config.getOptionalStringArray(
    'onboarding.defaults.assignerGroups',
  );
  if (!names || names.length === 0) {
    return new Set();
  }
  return new Set(
    names.map(name => (name.includes(':') ? name : `group:default/${name}`)),
  );
}

/**
 * Returns the set of catalog group entity refs that the given user is a
 * member of, derived from the user entity's `memberOf` relations. Returns an
 * empty set if the entity cannot be found or has no relations.
 */
export async function getCallerGroupRefs(
  catalogApi: CatalogApi,
  callerRef: string,
): Promise<Set<string>> {
  const entity = await catalogApi.getEntityByRef(callerRef);
  if (!entity?.relations) {
    return new Set();
  }
  return new Set(
    entity.relations
      .filter(relation => relation.type === RELATION_MEMBER_OF)
      .map(relation => relation.targetRef),
  );
}

/**
 * Returns true if `onboarding.defaults.assignerGroups` is unset/empty
 * (backward compatible no-op), or if the caller is a member of at least one
 * of the configured assigner groups.
 */
export async function isMemberOfAssignerGroup(
  catalogApi: CatalogApi,
  callerRef: string,
  config: RootConfigService,
): Promise<boolean> {
  const assignerGroups = getAssignerGroupRefs(config);
  if (assignerGroups.size === 0) {
    return true;
  }
  const callerGroups = await getCallerGroupRefs(catalogApi, callerRef);
  for (const group of callerGroups) {
    if (assignerGroups.has(group)) {
      return true;
    }
  }
  return false;
}
