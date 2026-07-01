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

import { mockServices, mockCredentials } from '@backstage/backend-test-utils';
import {
  assertUserAccess,
  getAssignerGroupRefs,
  getCallerGroupRefs,
  isMemberOfAssignerGroup,
  isSameUser,
} from './authz';
import { NotAllowedError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';

describe('isSameUser', () => {
  it('matches identical refs', () => {
    expect(isSameUser('user:default/jane', 'user:default/jane')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isSameUser('user:default/Jane', 'user:default/jane')).toBe(true);
  });

  it('matches by trailing name part when one side is a bare name', () => {
    expect(isSameUser('user:default/jane', 'jane')).toBe(true);
  });

  it('does not match different users', () => {
    expect(isSameUser('user:default/jane', 'user:default/john')).toBe(false);
  });
});

describe('getAssignerGroupRefs', () => {
  it('returns an empty set when unset', () => {
    const config = mockServices.rootConfig({ data: {} });
    expect(getAssignerGroupRefs(config).size).toBe(0);
  });

  it('normalizes bare group names to group:default/<name> refs', () => {
    const config = mockServices.rootConfig({
      data: { onboarding: { defaults: { assignerGroups: ['platform-team'] } } },
    });
    const refs = getAssignerGroupRefs(config);
    expect(refs.has('group:default/platform-team')).toBe(true);
  });

  it('passes through fully qualified refs unchanged', () => {
    const config = mockServices.rootConfig({
      data: {
        onboarding: {
          defaults: { assignerGroups: ['group:custom/platform-team'] },
        },
      },
    });
    const refs = getAssignerGroupRefs(config);
    expect(refs.has('group:custom/platform-team')).toBe(true);
  });
});

describe('getCallerGroupRefs', () => {
  it('returns group refs from memberOf relations', async () => {
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue({
        relations: [
          { type: 'memberOf', targetRef: 'group:default/platform-team' },
          { type: 'ownerOf', targetRef: 'component:default/some-service' },
        ],
      }),
    } as any;

    const groups = await getCallerGroupRefs(catalogApi, 'user:default/jane');
    expect(groups).toEqual(new Set(['group:default/platform-team']));
  });

  it('returns an empty set when the entity has no relations', async () => {
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue({}),
    } as any;

    const groups = await getCallerGroupRefs(catalogApi, 'user:default/jane');
    expect(groups.size).toBe(0);
  });

  it('returns an empty set when the entity is not found', async () => {
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue(undefined),
    } as any;

    const groups = await getCallerGroupRefs(catalogApi, 'user:default/jane');
    expect(groups.size).toBe(0);
  });
});

describe('isMemberOfAssignerGroup', () => {
  it('returns true when assignerGroups is unset (backward compatible)', async () => {
    const config = mockServices.rootConfig({ data: {} });
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue({ relations: [] }),
    } as any;
    const result = await isMemberOfAssignerGroup(
      catalogApi,
      'user:default/jane',
      config,
    );
    expect(result).toBe(true);
  });

  it('returns true when caller is a member of a configured group', async () => {
    const config = mockServices.rootConfig({
      data: { onboarding: { defaults: { assignerGroups: ['platform-team'] } } },
    });
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue({
        relations: [
          { type: 'memberOf', targetRef: 'group:default/platform-team' },
        ],
      }),
    } as any;
    const result = await isMemberOfAssignerGroup(
      catalogApi,
      'user:default/jane',
      config,
    );
    expect(result).toBe(true);
  });

  it('returns false when caller is not a member of any configured group', async () => {
    const config = mockServices.rootConfig({
      data: { onboarding: { defaults: { assignerGroups: ['platform-team'] } } },
    });
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue({
        relations: [{ type: 'memberOf', targetRef: 'group:default/other-team' }],
      }),
    } as any;
    const result = await isMemberOfAssignerGroup(
      catalogApi,
      'user:default/jane',
      config,
    );
    expect(result).toBe(false);
  });

  it('returns false when the caller entity is not found', async () => {
    const config = mockServices.rootConfig({
      data: { onboarding: { defaults: { assignerGroups: ['platform-team'] } } },
    });
    const catalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue(undefined),
    } as any;
    const result = await isMemberOfAssignerGroup(
      catalogApi,
      'user:default/jane',
      config,
    );
    expect(result).toBe(false);
  });
});

describe('assertUserAccess', () => {
  const ownerPermission = {
    name: 'onboarding.progress.read',
    attributes: {},
  };

  const elevatedPermission = {
    name: 'onboarding.team.read',
    attributes: {},
  };

  it('allows owner access when ownerPermission is allowed', async () => {
    const credentials = mockCredentials.user('user:default/jane');
    const permissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
    };

    await assertUserAccess({
      credentials,
      userId: 'user:default/jane',
      permissions: permissions as any,
      ownerPermission,
      elevatedPermission,
    });

    expect(permissions.authorize).toHaveBeenCalledWith(
      [{ permission: ownerPermission }],
      { credentials },
    );
  });

  it('throws NotAllowedError when owner permission is denied', async () => {
    const credentials = mockCredentials.user('user:default/jane');
    const permissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.DENY }]),
    };

    await expect(
      assertUserAccess({
        credentials,
        userId: 'user:default/jane',
        permissions: permissions as any,
        ownerPermission,
        elevatedPermission,
      }),
    ).rejects.toThrow(NotAllowedError);

    await expect(
      assertUserAccess({
        credentials,
        userId: 'user:default/jane',
        permissions: permissions as any,
        ownerPermission,
        elevatedPermission,
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('allows elevated access when different user has elevatedPermission', async () => {
    const credentials = mockCredentials.user('user:default/manager');
    const permissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
    };

    await assertUserAccess({
      credentials,
      userId: 'user:default/jane',
      permissions: permissions as any,
      ownerPermission,
      elevatedPermission,
    });

    expect(permissions.authorize).toHaveBeenCalledWith(
      [{ permission: elevatedPermission }],
      { credentials },
    );
  });

  it('throws NotAllowedError when different user lacks elevatedPermission', async () => {
    const credentials = mockCredentials.user('user:default/jane');
    const permissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.DENY }]),
    };

    await expect(
      assertUserAccess({
        credentials,
        userId: 'user:default/john',
        permissions: permissions as any,
        ownerPermission,
        elevatedPermission,
      }),
    ).rejects.toThrow(NotAllowedError);

    await expect(
      assertUserAccess({
        credentials,
        userId: 'user:default/john',
        permissions: permissions as any,
        ownerPermission,
        elevatedPermission,
      }),
    ).rejects.toThrow(
      'You are not allowed to access another user\u2019s onboarding progress',
    );
  });

  it('matches users case-insensitively for ownership check', async () => {
    const credentials = mockCredentials.user('user:default/Jane');
    const permissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
    };

    await assertUserAccess({
      credentials,
      userId: 'user:default/jane',
      permissions: permissions as any,
      ownerPermission,
      elevatedPermission,
    });

    expect(permissions.authorize).toHaveBeenCalledWith(
      [{ permission: ownerPermission }],
      { credentials },
    );
  });

  it('matches users by trailing name when one is bare', async () => {
    const credentials = mockCredentials.user('user:default/jane');
    const permissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
    };

    await assertUserAccess({
      credentials,
      userId: 'jane',
      permissions: permissions as any,
      ownerPermission,
      elevatedPermission,
    });

    expect(permissions.authorize).toHaveBeenCalledWith(
      [{ permission: ownerPermission }],
      { credentials },
    );
  });
});
