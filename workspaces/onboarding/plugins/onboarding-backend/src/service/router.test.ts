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
  upsertProgress: jest.fn(),
  getTeamProgress: jest.fn(),
} as unknown as jest.Mocked<DatabaseOnboardingStore>;

const mockPermissions = {
  authorize: jest.fn().mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
  authorizeConditional: jest.fn(),
};

async function createApp(callerRef = 'user:default/jane.doe') {
  const router = await createRouter({
    logger: mockServices.logger.mock(),
    config: new ConfigReader({
      onboarding: { defaults: { activeJoinerWindowDays: 90 } },
    }),
    store: mockStore,
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
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /progress/:userId', () => {
    it('returns stored progress for a user', async () => {
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
      mockStore.getProgress.mockResolvedValue(progress);

      const res = await request(app)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user:default/jane.doe');
      expect(res.body.tasks).toHaveLength(2);
      expect(res.body.tasks[0].status).toBe('done');
    });

    it('initializes progress from catalog template when not found', async () => {
      mockStore.getProgress.mockResolvedValue(undefined);
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
      expect(res.body.templateName).toBe('backend-engineer-platform');
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].status).toBe('pending');
      expect(mockStore.upsertProgress).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when no progress and no matching template', async () => {
      mockStore.getProgress.mockResolvedValue(undefined);
      mockCatalogApi.getEntityByRef.mockResolvedValue(undefined);

      const res = await request(app)
        .get(`/progress/${enc('user:default/unknown')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(404);
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

    it('returns 403 when permission is denied', async () => {
      mockPermissions.authorize.mockResolvedValue([
        { result: AuthorizeResult.DENY },
      ]);

      const res = await request(app)
        .get('/team/platform/stats')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
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
      mockStore.getProgress.mockResolvedValue({ ...janeProgress });

      const res = await request(ownerApp)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user:default/jane.doe');
    });

    it('allows an owner to update their own progress (short-name owner ref)', async () => {
      const ownerApp = await createApp('user:default/jane.doe');
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
      mockStore.getProgress.mockResolvedValue({ ...janeProgress });

      const res = await request(managerApp)
        .get(`/progress/${enc('user:default/jane.doe')}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user:default/jane.doe');
    });
  });
});
