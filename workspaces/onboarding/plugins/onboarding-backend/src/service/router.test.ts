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
import request from 'supertest';
import { parseEntityRef } from '@backstage/catalog-model';
import { ConfigReader } from '@backstage/config';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import { createRouter } from './router';
import { DatabaseOnboardingStore } from './OnboardingStore';

const enc = encodeURIComponent;

// ---- Shared test fixtures ----

const mockCatalogApi = {
  getEntities: jest.fn(),
  getEntityByRef: jest.fn(),
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
  addLocation: jest.fn(),
  getLocationByRef: jest.fn(),
  removeLocationById: jest.fn(),
  removeEntityByUid: jest.fn(),
  refreshEntity: jest.fn(),
  getEntityAncestors: jest.fn(),
  getEntityFacets: jest.fn(),
  validateEntity: jest.fn(),
  queryEntities: jest.fn(),
};

const mockStore: jest.Mocked<DatabaseOnboardingStore> = {
  getProgress: jest.fn(),
  listProgress: jest.fn(),
  createProgressIfAbsent: jest.fn(),
  upsertProgress: jest.fn(),
  getTeamProgress: jest.fn(),
  setBuddy: jest.fn().mockResolvedValue(true),
  getBuddyProgress: jest.fn().mockResolvedValue([]),
} as unknown as jest.Mocked<DatabaseOnboardingStore>;

const mockDraftStore = {
  getDraft: jest.fn(),
  upsertDraft: jest.fn().mockResolvedValue(undefined),
  markPublished: jest.fn().mockResolvedValue(undefined),
};

const mockVcs = {
  resolveProvider: jest.fn(),
  openPullRequest: jest
    .fn()
    .mockResolvedValue({ url: 'http://pr/1', number: 1 }),
  readFile: jest.fn(),
  getDefaultBranch: jest.fn().mockResolvedValue('main'),
};

const mockPermissions = {
  authorize: jest.fn().mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
  authorizeConditional: jest.fn(),
};

async function createApp(
  callerRef = 'user:default/jane.doe',
  configOverrides?: Record<string, unknown>,
  options?: { vcs?: unknown },
) {
  const baseDefaults = { activeJoinerWindowDays: 90 };
  const overrideOnboarding = configOverrides?.onboarding as
    | { defaults?: Record<string, unknown> }
    | undefined;
  const mergedConfig = {
    onboarding: {
      defaults: { ...baseDefaults, ...overrideOnboarding?.defaults },
    },
  };

  const router = await createRouter({
    logger: mockServices.logger.mock(),
    config: new ConfigReader(mergedConfig),
    store: mockStore,
    draftStore: mockDraftStore as any,
    vcs: (options ? options.vcs : mockVcs) as any,
    permissions: mockPermissions,
    httpAuth: mockServices.httpAuth.mock({
      credentials: async () => mockCredentials.user(callerRef),
    }),
    catalogApi: mockCatalogApi as any,
  });

  return express().use(router).use(mockErrorHandler());
}

// ---- Tests ----

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = await createApp();
    jest.clearAllMocks();
    mockPermissions.authorize.mockResolvedValue([
      { result: AuthorizeResult.ALLOW },
    ]);
    // Spec 001 FR-003: create-if-absent returns the persisted record; default the mock
    // to echo the initialized progress so assign handlers respond with it.
    mockStore.createProgressIfAbsent.mockImplementation(async p => p);
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /progress/:userId', () => {
    it('returns stored progress for a user as an array', async () => {
      const progress = {
        userId: 'user:default/jane.doe',
        templateName: 'backend-engineer-platform',
        startDate: '2026-03-01T00:00:00.000Z',
        tasks: [
          {
            taskId: 'setup-laptop',
            status: 'done',
            completedAt: '2026-03-01T01:00:00.000Z',
          },
          { taskId: 'meet-buddy', status: 'pending' },
        ],
      };
      // Spec 001 FR-002: GET now returns the full list of a user's progress records.
      mockStore.listProgress.mockResolvedValue([progress]);

      const res = await request(app)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].userId).toBe('user:default/jane.doe');
      expect(res.body[0].tasks).toHaveLength(2);
      expect(res.body[0].tasks[0].status).toBe('done');
    });

    it('returns every assigned template for a user (FR-002)', async () => {
      // Spec 001 FR-002 / SC-001: a user with two templates gets two records.
      mockStore.listProgress.mockResolvedValue([
        {
          userId: 'user:default/jane.doe',
          templateName: 'backend-engineer-platform',
          startDate: '2026-03-01T00:00:00.000Z',
          tasks: [{ taskId: 'a', status: 'pending' }],
        },
        {
          userId: 'user:default/jane.doe',
          templateName: 'manager-onboarding',
          startDate: '2026-03-02T00:00:00.000Z',
          tasks: [{ taskId: 'b', status: 'pending' }],
        },
      ]);

      const res2 = await request(app)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', '******');

      expect(res2.status).toBe(200);
      expect(res2.body).toHaveLength(2);
      expect(
        res2.body.map((p: { templateName: string }) => p.templateName),
      ).toEqual(['backend-engineer-platform', 'manager-onboarding']);
    });

    it('returns stored progress for a user via the proxy-safe by-ref/:kind/:namespace/:name route', async () => {
      const progress = {
        userId: 'user:default/jane.doe',
        templateName: 'backend-engineer-platform',
        startDate: '2026-03-01T00:00:00.000Z',
        tasks: [{ taskId: 'meet-buddy', status: 'pending' }],
      };
      mockStore.listProgress.mockResolvedValue([progress]);

      const res = await request(app)
        .get('/progress/by-ref/user/default/jane.doe')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(mockStore.listProgress).toHaveBeenCalledWith(
        'user:default/jane.doe',
      );
      expect(res.body[0].userId).toBe('user:default/jane.doe');
    });

    it('initializes progress from catalog template when not found', async () => {
      mockStore.listProgress.mockResolvedValue([]);
      // Spec 001 FR-003: seeding uses create-if-absent, returning the persisted record.
      mockStore.createProgressIfAbsent.mockImplementation(async p => p);
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        spec: { profile: { role: 'backend-engineer' } },
      });
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'backend-engineer-platform',
              title: 'BE Onboarding',
            },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'setup-laptop',
                      phase: 'day1',
                      title: 'Setup',
                      description: 'Setup desc',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].templateName).toBe('backend-engineer-platform');
      expect(res.body[0].tasks).toHaveLength(1);
      expect(res.body[0].tasks[0].status).toBe('pending');
      expect(mockStore.createProgressIfAbsent).toHaveBeenCalledTimes(1);
    });

    it('returns 200 with an empty array when no progress and no matching template (FR-002)', async () => {
      // Spec 001 FR-002 / SC-003: empty roster is a 200 [] empty state (was 404).
      mockStore.listProgress.mockResolvedValue([]);
      mockCatalogApi.getEntityByRef.mockResolvedValue(undefined);

      const res = await request(app)
        .get(`/progress/${enc('user:default/unknown')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 403 when permission is denied', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /progress/:userId/tasks/:taskId', () => {
    const existingProgress = {
      userId: 'user:default/jane.doe',
      templateName: 'backend-engineer-platform',
      startDate: '2026-03-01T00:00:00.000Z',
      tasks: [
        { taskId: 'setup-laptop', status: 'pending' },
        { taskId: 'meet-buddy', status: 'pending' },
      ],
    };

    beforeEach(() => {
      // Spec 001 FR-004: default single-template resolution — with exactly one
      // assigned template the backend resolves it without an explicit templateName.
      mockStore.listProgress.mockResolvedValue([{ ...existingProgress }]);
    });

    it('updates a task status to done', async () => {
      mockStore.getProgress.mockResolvedValue({ ...existingProgress });
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'backend-engineer-platform', title: 'BE' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'setup-laptop',
                      phase: 'day1',
                      title: 'Setup',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                    {
                      id: 'meet-buddy',
                      phase: 'day1',
                      title: 'Buddy',
                      description: '',
                      type: 'manual',
                      assignee: 'buddy',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(res.body.tasks[0].status).toBe('done');
      expect(res.body.tasks[0].completedAt).toBeDefined();
      expect(mockStore.upsertProgress).toHaveBeenCalled();
    });

    it('updates a task status via the proxy-safe by-ref/:kind/:namespace/:name route', async () => {
      mockStore.getProgress.mockResolvedValue({ ...existingProgress });

      const res = await request(app)
        .post('/progress/by-ref/user/default/jane.doe/tasks/setup-laptop')
        .set('Authorization', '******')
        .send({ status: 'blocked', blockedReason: 'waiting on IT' });

      expect(res.status).toBe(200);
      expect(mockStore.getProgress).toHaveBeenCalledWith(
        'user:default/jane.doe',
        'backend-engineer-platform',
      );
      expect(res.body.tasks[0].status).toBe('blocked');
    });

    it('rejects invalid status', async () => {
      mockStore.getProgress.mockResolvedValue({ ...existingProgress });

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown task', async () => {
      mockStore.getProgress.mockResolvedValue({ ...existingProgress });

      const res = await request(app)
        .post(
          `/progress/${enc('user:default/jane.doe')}/tasks/nonexistent-task`,
        )
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'done' });

      expect(res.status).toBe(404);
    });

    it('rejects done status when dependencies are unmet', async () => {
      const progressWithDeps = {
        ...existingProgress,
        tasks: [
          { taskId: 'security-training', status: 'pending' },
          { taskId: 'oncall-shadow', status: 'pending' },
        ],
      };
      mockStore.getProgress.mockResolvedValue({ ...progressWithDeps });
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'backend-engineer-platform', title: 'BE' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'week1',
                  tasks: [
                    {
                      id: 'security-training',
                      phase: 'week1',
                      title: 'Security',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'week1',
                    },
                    {
                      id: 'oncall-shadow',
                      phase: 'week1',
                      title: 'Shadow',
                      description: '',
                      type: 'manual',
                      assignee: 'buddy',
                      dependsOn: ['security-training'],
                      duePhase: 'week1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/oncall-shadow`)
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'done' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Unmet dependencies');
    });

    it('updates only the record named by templateName (FR-004)', async () => {
      // Spec 001 FR-004: an explicit templateName selects which template's record to
      // update when the user has more than one assigned template.
      mockStore.listProgress.mockResolvedValue([
        { ...existingProgress, templateName: 'backend-engineer-platform' },
        { ...existingProgress, templateName: 'manager-onboarding' },
      ]);
      mockStore.getProgress.mockResolvedValue({
        ...existingProgress,
        templateName: 'manager-onboarding',
      });

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', '******')
        .send({ status: 'blocked', templateName: 'manager-onboarding' });

      expect(res.status).toBe(200);
      // getProgress is resolved by the explicit (user, template) composite key.
      expect(mockStore.getProgress).toHaveBeenCalledWith(
        'user:default/jane.doe',
        'manager-onboarding',
      );
      expect(res.body.templateName).toBe('manager-onboarding');
    });

    it('returns 400 when templateName omitted and user has multiple templates (FR-004)', async () => {
      // Spec 001 FR-004: with >1 assigned template and no templateName the request is
      // ambiguous and must be rejected.
      mockStore.listProgress.mockResolvedValue([
        { ...existingProgress, templateName: 'backend-engineer-platform' },
        { ...existingProgress, templateName: 'manager-onboarding' },
      ]);

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', '******')
        .send({ status: 'done' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('templateName is required');
    });

    it('succeeds without templateName when user has a single template (SC-003)', async () => {
      // Spec 001 SC-003: old single-template clients keep working without templateName.
      mockStore.listProgress.mockResolvedValue([{ ...existingProgress }]);
      mockStore.getProgress.mockResolvedValue({ ...existingProgress });

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', '******')
        .send({ status: 'blocked' });

      expect(res.status).toBe(200);
      expect(mockStore.getProgress).toHaveBeenCalledWith(
        'user:default/jane.doe',
        'backend-engineer-platform',
      );
      expect(res.body.tasks[0].status).toBe('blocked');
    });

    it('returns 404 when templateName omitted and user has no templates', async () => {
      // Spec 001 FR-004: no assigned templates → nothing to update.
      mockStore.listProgress.mockResolvedValue([]);

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', '******')
        .send({ status: 'done' });

      expect(res.status).toBe(404);
    });

    it('returns 403 when permission is denied', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'done' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /progress/:userId/buddy', () => {
    it('allows setting a buddy when permission is granted', async () => {
      mockStore.setBuddy.mockResolvedValue(true);

      const res = await request(app)
        .post(`/progress/${enc('user:default/new-joiner')}/buddy`)
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        userId: 'user:default/new-joiner',
        buddyUserId: 'user:default/mentor',
      });
      expect(mockStore.setBuddy).toHaveBeenCalledWith(
        'user:default/new-joiner',
        'user:default/mentor',
      );
    });

    it('allows setting a buddy via the proxy-safe by-ref/:kind/:namespace/:name route', async () => {
      mockStore.setBuddy.mockResolvedValue(true);

      const res = await request(app)
        .post('/progress/by-ref/user/default/new-joiner/buddy')
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(200);
      expect(mockStore.setBuddy).toHaveBeenCalledWith(
        'user:default/new-joiner',
        'user:default/mentor',
      );
    });

    it('allows clearing a buddy by sending null', async () => {
      mockStore.setBuddy.mockResolvedValue(true);

      const res = await request(app)
        .post(`/progress/${enc('user:default/new-joiner')}/buddy`)
        .set('Authorization', '******')
        .send({ buddyUserId: null });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        userId: 'user:default/new-joiner',
        buddyUserId: undefined,
      });
      expect(mockStore.setBuddy).toHaveBeenCalledWith(
        'user:default/new-joiner',
        undefined,
      );
    });

    it('returns 404 when user has no onboarding progress', async () => {
      mockStore.setBuddy.mockResolvedValue(false);

      const res = await request(app)
        .post(`/progress/${enc('user:default/unknown')}/buddy`)
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('No onboarding progress found');
    });

    it('returns 403 when permission is denied', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .post(`/progress/${enc('user:default/new-joiner')}/buddy`)
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(403);
    });

    it('allows the buddy assignment when caller is a member of a configured assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });
      mockStore.setBuddy.mockResolvedValue(true);

      const res = await request(appWithGroups)
        .post(`/progress/${enc('user:default/new-joiner')}/buddy`)
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(200);
    });

    it('denies the buddy assignment when caller is not a member of a configured assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/other' }],
      });

      const res = await request(appWithGroups)
        .post(`/progress/${enc('user:default/new-joiner')}/buddy`)
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain(
        'not a member of an authorized assigner group',
      );
    });
  });

  describe('GET /teams/mine', () => {
    it('returns matching assigner groups when caller is a member', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform', 'infrastructure'],
          },
        },
      });

      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [
          { type: 'memberOf', targetRef: 'group:default/platform' },
          { type: 'memberOf', targetRef: 'group:default/another-team' },
        ],
      });

      const res = await request(appWithGroups)
        .get('/teams/mine')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ teams: ['platform'] });
    });

    it('returns empty array when assignerGroups is not configured', async () => {
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });

      const res = await request(app)
        .get('/teams/mine')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ teams: [] });
    });
  });

  describe('GET /assigner/me', () => {
    it('returns true when permission allows and caller is in assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });

      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.ALLOW },
      ]);
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });

      const res = await request(appWithGroups)
        .get('/assigner/me')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAssigner: true });
    });

    it('returns false when permission denies', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .get('/assigner/me')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAssigner: false });
    });

    it('returns false when permission allows but caller is not in assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });

      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.ALLOW },
      ]);
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/other' }],
      });

      const res = await request(appWithGroups)
        .get('/assigner/me')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAssigner: false });
    });
  });

  describe('GET /buddies/mine', () => {
    it('returns joiner summaries for users with this caller as buddy', async () => {
      const recentDate = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      ).toISOString();
      mockStore.getBuddyProgress.mockResolvedValue([
        {
          userId: 'user:default/joiner-a',
          templateName: 'backend-engineer',
          startDate: recentDate,
          buddyUserId: 'user:default/jane.doe',
          tasks: [
            { taskId: 'task1', status: 'done' },
            { taskId: 'task2', status: 'pending' },
            { taskId: 'task3', status: 'blocked', blockedReason: 'Waiting' },
          ],
        },
        {
          userId: 'user:default/joiner-b',
          templateName: 'frontend-engineer',
          startDate: recentDate,
          buddyUserId: 'user:default/jane.doe',
          tasks: [
            { taskId: 'task1', status: 'done' },
            { taskId: 'task2', status: 'done' },
          ],
        },
      ]);

      mockCatalogApi.getEntitiesByRefs.mockResolvedValue({
        items: [
          {
            metadata: { name: 'joiner-a' },
            spec: { profile: { displayName: 'Joiner A' } },
          },
          {
            metadata: { name: 'jane.doe' },
            spec: { profile: { displayName: 'Jane Doe' } },
          },
          {
            metadata: { name: 'joiner-b' },
            spec: { profile: { displayName: 'Joiner B' } },
          },
        ],
      });

      const res = await request(app)
        .get('/buddies/mine')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({
        userId: 'user:default/joiner-a',
        displayName: 'Joiner A',
        role: 'backend-engineer',
        completionPercent: 33,
        blockedTaskCount: 1,
        buddyUserId: 'user:default/jane.doe',
      });
      expect(res.body[1]).toMatchObject({
        userId: 'user:default/joiner-b',
        displayName: 'Joiner B',
        role: 'frontend-engineer',
        completionPercent: 100,
        blockedTaskCount: 0,
      });
      expect(mockStore.getBuddyProgress).toHaveBeenCalledWith(
        'user:default/jane.doe',
      );
      expect(mockCatalogApi.getEntitiesByRefs).toHaveBeenCalledWith(
        expect.objectContaining({
          entityRefs: expect.arrayContaining([
            'user:default/joiner-a',
            'user:default/joiner-b',
            'user:default/jane.doe',
          ]),
        }),
      );
    });

    it('resolves the buddy display name when the buddy is not one of the joiners', async () => {
      const recentDate = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      ).toISOString();
      mockStore.getBuddyProgress.mockResolvedValue([
        {
          userId: 'user:default/joiner-a',
          templateName: 'backend-engineer',
          startDate: recentDate,
          buddyUserId: 'user:default/mentor-outside-list',
          tasks: [{ taskId: 'task1', status: 'done' }],
        },
      ]);

      mockCatalogApi.getEntitiesByRefs.mockResolvedValue({
        items: [
          {
            metadata: { name: 'joiner-a' },
            spec: { profile: { displayName: 'Joiner A' } },
          },
          {
            metadata: { name: 'mentor-outside-list' },
            spec: { profile: { displayName: 'Mentor Outside' } },
          },
        ],
      });

      const res = await request(app)
        .get('/buddies/mine')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        userId: 'user:default/joiner-a',
        buddyUserId: 'user:default/mentor-outside-list',
        buddyDisplayName: 'Mentor Outside',
      });
    });
  });

  describe('GET /team/:teamName/stats', () => {
    it('returns team stats with active joiners', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'jane.doe' },
            spec: { profile: { displayName: 'Jane Doe' } },
          },
          {
            metadata: { name: 'taylor.kim' },
            spec: { profile: { displayName: 'Taylor Kim' } },
          },
        ],
      });

      // Mock caller is a member of the team
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });

      mockStore.getTeamProgress.mockResolvedValue([
        {
          userId: 'user:default/jane.doe',
          templateName: 'backend-engineer-platform',
          startDate: recentDate.toISOString(),
          tasks: [
            { taskId: 'a', status: 'done' },
            { taskId: 'b', status: 'pending' },
          ],
        },
        {
          userId: 'user:default/taylor.kim',
          templateName: 'backend-engineer-platform',
          startDate: recentDate.toISOString(),
          tasks: [
            { taskId: 'a', status: 'pending' },
            { taskId: 'b', status: 'blocked', blockedReason: 'Waiting' },
          ],
        },
      ]);

      const res = await request(app)
        .get('/team/platform/stats')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.teamName).toBe('platform');
      expect(res.body.activeJoiners).toHaveLength(2);
      expect(res.body.avgCompletionPercent).toBeGreaterThanOrEqual(0);
      expect(res.body.totalBlockedTasks).toBe(1);
    });

    it('emits one roster row per (user, template) for multi-template joiners (FR-006)', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'jane.doe' },
            spec: { profile: { displayName: 'Jane Doe' } },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });

      // Spec 001 FR-006: one joiner with two templates yields two summary rows.
      mockStore.getTeamProgress.mockResolvedValue([
        {
          userId: 'user:default/jane.doe',
          templateName: 'backend-engineer-platform',
          startDate: recentDate.toISOString(),
          tasks: [{ taskId: 'a', status: 'pending' }],
        },
        {
          userId: 'user:default/jane.doe',
          templateName: 'manager-onboarding',
          startDate: recentDate.toISOString(),
          tasks: [{ taskId: 'b', status: 'pending' }],
        },
      ]);

      const res = await request(app)
        .get('/team/platform/stats')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body.activeJoiners).toHaveLength(2);
      // Both rows share the same userId but carry distinct templateName keys.
      expect(
        res.body.activeJoiners.map(
          (j: { templateName: string }) => j.templateName,
        ),
      ).toEqual(['backend-engineer-platform', 'manager-onboarding']);
      expect(
        res.body.activeJoiners.every(
          (j: { userId: string }) => j.userId === 'user:default/jane.doe',
        ),
      ).toBe(true);
    });

    it('returns 403 when caller is not a member of the team', async () => {
      // Mock caller is NOT a member of the team
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [],
      });

      const res = await request(app)
        .get('/team/platform/stats')
        .set('Authorization', '******');

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Not a member of team');
    });

    it('returns 403 when permission is denied', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .get('/team/platform/stats')
        .set('Authorization', '******');

      expect(res.status).toBe(403);
    });

    it('allows a team member to view stats when assignerGroups includes the team group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });

      mockCatalogApi.getEntities.mockResolvedValue({ items: [] });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });
      mockStore.getTeamProgress.mockResolvedValue([]);

      const res = await request(appWithGroups)
        .get('/team/platform/stats')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body.teamName).toBe('platform');
    });

    it('denies a team member from viewing stats when assignerGroups does not include the team group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['other-team'],
          },
        },
      });

      // Caller is a member of the "platform" team, but assignerGroups only
      // includes "other-team", so full-roster access should be denied.
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });

      const res = await request(appWithGroups)
        .get('/team/platform/stats')
        .set('Authorization', '******');

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain(
        'restricted to configured assigner groups',
      );
    });

    it('resolves buddy display names for active joiners', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'jane.doe' },
            spec: { profile: { displayName: 'Jane Doe' } },
          },
        ],
      });

      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });

      mockStore.getTeamProgress.mockResolvedValue([
        {
          userId: 'user:default/jane.doe',
          templateName: 'backend-engineer-platform',
          startDate: recentDate.toISOString(),
          buddyUserId: 'user:default/mentor-not-in-team',
          tasks: [
            { taskId: 'a', status: 'done' },
            { taskId: 'b', status: 'pending' },
          ],
        },
      ]);

      mockCatalogApi.getEntitiesByRefs.mockResolvedValue({
        items: [
          {
            metadata: { name: 'jane.doe' },
            spec: { profile: { displayName: 'Jane Doe' } },
          },
          {
            metadata: { name: 'mentor-not-in-team' },
            spec: { profile: { displayName: 'Mentor Person' } },
          },
        ],
      });

      const res = await request(app)
        .get('/team/platform/stats')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(mockCatalogApi.getEntitiesByRefs).toHaveBeenCalledWith(
        expect.objectContaining({
          entityRefs: expect.arrayContaining([
            'user:default/jane.doe',
            'user:default/mentor-not-in-team',
          ]),
        }),
      );
      expect(res.body.activeJoiners[0]).toMatchObject({
        buddyUserId: 'user:default/mentor-not-in-team',
        buddyDisplayName: 'Mentor Person',
      });
    });
  });

  describe('GET /templates', () => {
    it('returns templates from catalog', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'be-template',
              title: 'Backend Template',
              description: 'For BE',
            },
            spec: {
              role: 'backend-engineer',
              team: 'platform',
              phases: [{ id: 'day1', tasks: [] }],
            },
          },
        ],
      });

      const res = await request(app)
        .get('/templates')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].metadata.name).toBe('be-template');
      expect(res.body[0].spec.role).toBe('backend-engineer');
    });
  });

  describe('GET /users/search', () => {
    const catalogUsers = [
      {
        kind: 'User',
        metadata: { name: 'jane.doe', namespace: 'default' },
        spec: {
          profile: { displayName: 'Jane Doe', email: 'jane@example.com' },
        },
      },
      {
        kind: 'User',
        metadata: { name: 'john.smith', namespace: 'default' },
        spec: {
          profile: { displayName: 'John Smith', email: 'john@example.com' },
        },
      },
      {
        kind: 'User',
        metadata: { name: 'alice', namespace: 'default' },
        spec: {
          profile: { displayName: 'Alice Cooper', email: 'alice@acme.io' },
        },
      },
    ];

    it('filters all catalog users in memory across name/displayName/email', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({ items: catalogUsers });

      const res = await request(app)
        .get('/users/search?query=jane')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          entityRef: 'user:default/jane.doe',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
        },
      ]);
      // Reads real User entities (not the FTS index) so results are reliable.
      expect(mockCatalogApi.getEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { kind: 'User' },
          limit: 1000,
        }),
      );
      expect(mockCatalogApi.queryEntities).not.toHaveBeenCalled();

      // Email match across a different field.
      const byEmail = await request(app)
        .get('/users/search?query=acme.io')
        .set('Authorization', 'Bearer mock-token');
      expect(byEmail.body).toEqual([
        {
          entityRef: 'user:default/alice',
          displayName: 'Alice Cooper',
          email: 'alice@acme.io',
        },
      ]);
    });

    it('lists users sorted by display name when the query is blank', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({ items: catalogUsers });

      const res = await request(app)
        .get('/users/search?query=   ')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(
        res.body.map((u: { displayName: string }) => u.displayName),
      ).toEqual(['Alice Cooper', 'Jane Doe', 'John Smith']);
    });

    it('rejects a query that exceeds 100 characters', async () => {
      const res = await request(app)
        .get(`/users/search?query=${'a'.repeat(101)}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(400);
      expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
    });

    it('allows the search when caller is a member of a configured assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/platform' }],
      });
      mockCatalogApi.getEntities.mockResolvedValue({ items: catalogUsers });

      const res = await request(appWithGroups)
        .get('/users/search?query=jane')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
    });

    it('denies the search when caller is not a member of a configured assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { name: 'jane.doe' },
        relations: [{ type: 'memberOf', targetRef: 'group:default/other' }],
      });

      const res = await request(appWithGroups)
        .get('/users/search?query=jane')
        .set('Authorization', '******');

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain(
        'not a member of an authorized assigner group',
      );
      expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
    });
  });

  describe('POST /templates/:templateName/assign/:userId', () => {
    it('assigns a template to a user and returns initialized progress', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        kind: 'User',
        metadata: { name: 'new-joiner' },
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/templates/be-template/assign/${enc('user:default/new-joiner')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.templateName).toBe('be-template');
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].status).toBe('pending');
    });

    it('creates progress if absent and does not overwrite existing records (FR-003/SC-002)', async () => {
      // Spec 001 FR-003 / SC-002: assign must use create-if-absent semantics so
      // re-assigning a template never clobbers the user's other templates or progress.
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        kind: 'User',
        metadata: { name: 'new-joiner' },
      });
      // Simulate an already-existing record whose completed task must be preserved.
      const existing = {
        userId: 'user:default/new-joiner',
        templateName: 'be-template',
        startDate: '2026-01-01T00:00:00.000Z',
        tasks: [{ taskId: 'task-1', status: 'done' }],
      };
      mockStore.createProgressIfAbsent.mockResolvedValue(existing);

      const res = await request(app)
        .post(`/templates/be-template/assign/${enc('user:default/new-joiner')}`)
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      // The store's create-if-absent path is used, not the merging upsert.
      expect(mockStore.createProgressIfAbsent).toHaveBeenCalledTimes(1);
      expect(mockStore.upsertProgress).not.toHaveBeenCalled();
      // The pre-existing completed task survives re-assignment.
      expect(res.body.tasks[0].status).toBe('done');
    });
    // Entra ID-integrated deployments) normalize request URLs and decode
    // "%2F" to a literal "/" before forwarding to the backend. Since every
    // user entity ref contains a "/" (kind:namespace/name), the userId path
    // param must still match when it arrives as a raw, un-encoded segment.
    it('assigns a template when the userId path segment arrives with an un-encoded slash', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        kind: 'User',
        metadata: { name: 'new-joiner' },
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/templates/be-template/assign/user:default/new-joiner')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body.templateName).toBe('be-template');
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].status).toBe('pending');
    });

    it('assigns a template via the proxy-safe by-ref/:kind/:namespace/:name route', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        kind: 'User',
        metadata: { name: 'new-joiner' },
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/templates/be-template/assign/by-ref/user/default/new-joiner')
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(res.body.templateName).toBe('be-template');
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].status).toBe('pending');
    });

    it('returns 400 when user does not exist in catalog', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue(undefined);

      const res = await request(app)
        .post(
          `/templates/be-template/assign/${enc('user:default/missing-user')}`,
        )
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain(
        'user:default/missing-user was not found in the catalog',
      );
    });

    it('returns 404 for non-existent template', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({ items: [] });

      const res = await request(app)
        .post(`/templates/nonexistent/assign/${enc('user:default/someone')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(404);
    });

    it('returns 403 when permission is denied', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .post(`/templates/be-template/assign/${enc('user:default/someone')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
    });

    it('calls setBuddy when buddyUserId is provided in body', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockImplementation(async (ref: string) => ({
        kind: 'User',
        metadata: { name: parseEntityRef(ref).name },
      }));
      mockStore.upsertProgress.mockResolvedValue(undefined);
      mockStore.setBuddy.mockResolvedValue(true);

      const res = await request(app)
        .post(`/templates/be-template/assign/${enc('user:default/new-joiner')}`)
        .set('Authorization', '******')
        .send({ buddyUserId: 'user:default/mentor' });

      expect(res.status).toBe(200);
      expect(mockStore.setBuddy).toHaveBeenCalledWith(
        'user:default/new-joiner',
        'user:default/mentor',
      );
    });

    it('does not call setBuddy when buddyUserId is omitted', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        kind: 'User',
        metadata: { name: 'new-joiner' },
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);
      mockStore.setBuddy.mockClear();

      const res = await request(app)
        .post(`/templates/be-template/assign/${enc('user:default/new-joiner')}`)
        .set('Authorization', '******');

      expect(res.status).toBe(200);
      expect(mockStore.setBuddy).not.toHaveBeenCalled();
    });

    it('allows the assignment when caller is a member of a configured assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockImplementation(async (ref: string) => {
        if (ref === 'user:default/jane.doe') {
          return {
            metadata: { name: 'jane.doe' },
            relations: [
              { type: 'memberOf', targetRef: 'group:default/platform' },
            ],
          };
        }
        return { kind: 'User', metadata: { name: 'new-joiner' } };
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(appWithGroups)
        .post(`/templates/be-template/assign/${enc('user:default/new-joiner')}`)
        .set('Authorization', '******');

      expect(res.status).toBe(200);
    });

    it('assigns a template to a user when userId is provided in request body (POST /templates/:templateName/assign)', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'sas-developer-onboarding',
              title: 'SAS Developer Onboarding',
              description: '',
            },
            spec: {
              role: 'software-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue({
        kind: 'User',
        metadata: { name: 'estehsan.tariq_sas.se' },
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/templates/sas-developer-onboarding/assign')
        .set('Authorization', '******')
        .send({
          userId: 'user:default/estehsan.tariq_sas.se',
        });

      expect(res.status).toBe(200);
      expect(res.body.templateName).toBe('sas-developer-onboarding');
      expect(res.body.userId).toBe('user:default/estehsan.tariq_sas.se');
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].status).toBe('pending');
    });

    it('assigns a template and buddy when both are provided in request body', async () => {
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'sas-developer-onboarding',
              title: 'SAS Developer Onboarding',
              description: '',
            },
            spec: {
              role: 'software-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockImplementation(async (ref: string) => {
        if (ref === 'user:default/estehsan.tariq_sas.se') {
          return { kind: 'User', metadata: { name: 'estehsan.tariq_sas.se' } };
        }
        if (ref === 'user:default/mentor_sas.se') {
          return { kind: 'User', metadata: { name: 'mentor_sas.se' } };
        }
        return undefined;
      });
      mockStore.upsertProgress.mockResolvedValue(undefined);
      mockStore.setBuddy.mockResolvedValue(true);

      const res = await request(app)
        .post('/templates/sas-developer-onboarding/assign')
        .set('Authorization', '******')
        .send({
          userId: 'user:default/estehsan.tariq_sas.se',
          buddyUserId: 'user:default/mentor_sas.se',
        });

      expect(res.status).toBe(200);
      expect(res.body.buddyUserId).toBe('user:default/mentor_sas.se');
      expect(mockStore.setBuddy).toHaveBeenCalledWith(
        'user:default/estehsan.tariq_sas.se',
        'user:default/mentor_sas.se',
      );
    });

    it('resolves a user by email when direct ref lookup misses', async () => {
      mockCatalogApi.getEntities.mockImplementation(async (opts: any) => {
        if (opts?.filter?.kind === 'User') {
          return {
            items: [
              {
                kind: 'User',
                metadata: {
                  name: 'estehsan.tariq_sas.se',
                  namespace: 'default',
                },
                spec: { profile: { email: 'estehsan.tariq@sas.se' } },
              },
            ],
          };
        }
        return {
          items: [
            {
              metadata: {
                name: 'sas-developer-onboarding',
                title: 'SAS Developer Onboarding',
              },
              spec: {
                role: 'software-engineer',
                phases: [{ id: 'day1', tasks: [] }],
              },
            },
          ],
        };
      });
      mockCatalogApi.getEntityByRef.mockResolvedValue(undefined);
      mockStore.upsertProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/templates/sas-developer-onboarding/assign')
        .set('Authorization', '******')
        .send({
          userId: 'estehsan.tariq@sas.se',
        });

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user:default/estehsan.tariq_sas.se');
    });

    it('denies the assignment when caller is not a member of a configured assigner group', async () => {
      const appWithGroups = await createApp('user:default/jane.doe', {
        onboarding: {
          defaults: {
            activeJoinerWindowDays: 90,
            assignerGroups: ['platform'],
          },
        },
      });
      mockCatalogApi.getEntities.mockResolvedValue({
        items: [
          {
            metadata: { name: 'be-template', title: 'BE', description: '' },
            spec: {
              role: 'backend-engineer',
              phases: [
                {
                  id: 'day1',
                  tasks: [
                    {
                      id: 'task-1',
                      phase: 'day1',
                      title: 'Task 1',
                      description: '',
                      type: 'manual',
                      assignee: 'self',
                      duePhase: 'day1',
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      mockCatalogApi.getEntityByRef.mockImplementation(async (ref: string) => {
        if (ref === 'user:default/jane.doe') {
          return {
            metadata: { name: 'jane.doe' },
            relations: [{ type: 'memberOf', targetRef: 'group:default/other' }],
          };
        }
        return { kind: 'User', metadata: { name: 'new-joiner' } };
      });

      const res = await request(appWithGroups)
        .post(`/templates/be-template/assign/${enc('user:default/new-joiner')}`)
        .set('Authorization', '******');

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain(
        'not a member of an authorized assigner group',
      );
    });
  });

  describe('user-scoped access control (IDOR protection)', () => {
    const janeProgress = {
      userId: 'user:default/jane.doe',
      templateName: 'backend-engineer-platform',
      startDate: '2026-03-01T00:00:00.000Z',
      tasks: [
        { taskId: 'setup-laptop', status: 'pending' },
        { taskId: 'meet-buddy', status: 'pending' },
      ],
    };

    // Permissions impl that denies the elevated (team-read) permission but
    // allows the owner's own progress read/update permissions.
    function denyElevated() {
      mockPermissions.authorize.mockImplementation(async (requests: any[]) =>
        requests.map(r => ({
          result:
            r.permission.name === 'onboarding.team.read'
              ? AuthorizeResult.DENY
              : AuthorizeResult.ALLOW,
        })),
      );
    }

    it('allows an owner to read their own progress', async () => {
      const ownerApp = await createApp('user:default/jane.doe');
      mockStore.listProgress.mockResolvedValue([{ ...janeProgress }]);

      const res = await request(ownerApp)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body[0].userId).toBe('user:default/jane.doe');
    });

    it('allows an owner to update their own progress (short-name owner ref)', async () => {
      const ownerApp = await createApp('user:default/jane.doe');
      mockStore.listProgress.mockResolvedValue([{ ...janeProgress }]);
      mockStore.getProgress.mockResolvedValue({ ...janeProgress });
      mockStore.upsertProgress.mockResolvedValue(undefined);

      // Owner identified by full ref, target supplied as short name.
      const res = await request(ownerApp)
        .post(`/progress/jane.doe/tasks/meet-buddy`)
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'in-progress' });

      expect(res.status).toBe(200);
    });

    it('denies a different user without team-read from reading progress', async () => {
      denyElevated();
      const otherApp = await createApp('user:default/mallory');
      mockStore.getProgress.mockResolvedValue({ ...janeProgress });

      const res = await request(otherApp)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
      expect(mockStore.getProgress).not.toHaveBeenCalled();
    });

    it('denies a different user without team-read from updating progress', async () => {
      denyElevated();
      const otherApp = await createApp('user:default/mallory');
      mockStore.getProgress.mockResolvedValue({ ...janeProgress });

      const res = await request(otherApp)
        .post(`/progress/${enc('user:default/jane.doe')}/tasks/setup-laptop`)
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'done' });

      expect(res.status).toBe(403);
      expect(mockStore.upsertProgress).not.toHaveBeenCalled();
    });

    it('allows a different user WITH team-read to read another user progress', async () => {
      // Default authorize mock ALLOWs all permissions, simulating a
      // manager/buddy/admin who holds the elevated team-read permission.
      const managerApp = await createApp('user:default/manager');
      mockStore.listProgress.mockResolvedValue([{ ...janeProgress }]);

      const res = await request(managerApp)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body[0].userId).toBe('user:default/jane.doe');
    });
  });

  describe('Template Studio', () => {
    const validTemplate = {
      apiVersion: 'onboarding.backstage.io/v1',
      kind: 'OnboardingTemplate',
      metadata: { name: 'eng', title: 'Engineer' },
      spec: { role: 'engineer', phases: [] },
    };

    it('lists blocks from the library', async () => {
      const res = await request(app)
        .get('/blocks')
        .set('Authorization', '******');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('rejects saving a draft with validation errors', async () => {
      const res = await request(app)
        .put('/templates/eng/draft')
        .set('Authorization', '******')
        .send({
          template: {
            ...validTemplate,
            metadata: { name: '', title: '' },
            spec: { role: '', phases: [] },
          },
        });
      expect(res.status).toBe(400);
      expect(res.body.issues.length).toBeGreaterThan(0);
      expect(mockDraftStore.upsertDraft).not.toHaveBeenCalled();
    });

    it('saves a valid draft', async () => {
      mockDraftStore.getDraft.mockResolvedValue(undefined);
      const res = await request(app)
        .put('/templates/eng/draft')
        .set('Authorization', '******')
        .send({
          template: validTemplate,
          sourceLocation: 'url:https://github.com/o/r/blob/main/eng.yaml',
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draft');
      expect(mockDraftStore.upsertDraft).toHaveBeenCalled();
    });

    it('publishes a draft and opens a PR', async () => {
      mockDraftStore.getDraft.mockResolvedValue({
        name: 'eng',
        template: validTemplate,
        sourceLocation: undefined,
        updatedAt: '2026-08-01T00:00:00.000Z',
        status: 'draft',
      });

      const res = await request(app)
        .post('/templates/eng/publish')
        .set('Authorization', '******')
        .send({
          title: 'Update onboarding template',
          repoUrl: 'https://github.com/o/r',
          filePath: 'catalog/onboarding/eng.yaml',
        });

      expect(res.status).toBe(200);
      expect(res.body.url).toBe('http://pr/1');
      expect(res.body.number).toBe(1);
      expect(mockVcs.openPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ repoUrl: 'https://github.com/o/r' }),
      );
      expect(mockDraftStore.markPublished).toHaveBeenCalledWith('eng');
    });

    describe('without a VCS provider (config #2)', () => {
      it('returns 501 when publishing a valid draft', async () => {
        const noVcsApp = await createApp('user:default/jane.doe', undefined, {
          vcs: undefined,
        });
        mockDraftStore.getDraft.mockResolvedValue({
          name: 'eng',
          template: validTemplate,
          sourceLocation: undefined,
          updatedAt: '2026-08-01T00:00:00.000Z',
          status: 'draft',
        });

        const res = await request(noVcsApp)
          .post('/templates/eng/publish')
          .set('Authorization', '******')
          .send({
            title: 'Update onboarding template',
            repoUrl: 'https://github.com/o/r',
            filePath: 'catalog/onboarding/eng.yaml',
          });

        expect(res.status).toBe(501);
        expect(res.body.error.name).toBe('NotImplementedError');
        expect(res.body.error.message).toBe(
          'VCS provider is not configured for template publishing',
        );
      });

      it('still 404s a missing draft without a provider', async () => {
        const noVcsApp = await createApp('user:default/jane.doe', undefined, {
          vcs: undefined,
        });
        mockDraftStore.getDraft.mockResolvedValue(undefined);

        const res = await request(noVcsApp)
          .post('/templates/eng/publish')
          .set('Authorization', '******')
          .send({ title: 'x', repoUrl: 'https://github.com/o/r' });

        expect(res.status).toBe(404);
      });

      it('still 400s an invalid draft without a provider', async () => {
        const noVcsApp = await createApp('user:default/jane.doe', undefined, {
          vcs: undefined,
        });
        mockDraftStore.getDraft.mockResolvedValue({
          name: 'eng',
          template: {
            ...validTemplate,
            metadata: { name: '', title: '' },
            spec: { role: '', phases: [] },
          },
          sourceLocation: undefined,
          updatedAt: '2026-08-01T00:00:00.000Z',
          status: 'draft',
        });

        const res = await request(noVcsApp)
          .post('/templates/eng/publish')
          .set('Authorization', '******')
          .send({ title: 'x', repoUrl: 'https://github.com/o/r' });

        expect(res.status).toBe(400);
        expect(res.body.issues.length).toBeGreaterThan(0);
      });
    });

    it('denies template writes without permission', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);
      const res = await request(app)
        .get('/blocks')
        .set('Authorization', '******');
      expect(res.status).toBe(403);
    });
  });
});
