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
  TestDatabases,
} from '@backstage/backend-test-utils';
import { createRouter } from './router';
import { DatabaseOnboardingStore } from './OnboardingStore';

const enc = encodeURIComponent;

// Spec 001: full-stack regression test (real router + real DatabaseOnboardingStore,
// no mocked store) covering the exact user-reported scenario — assigning two
// different templates to one user must keep them as two separate checklists,
// and switching between them in the frontend (driven by templateName) must
// return each template's own distinct task state, never a merged one.
describe('createRouter multi-template assignment (real store)', () => {
  const databases = TestDatabases.create({
    ids: ['SQLITE_3'],
    disableDocker: true,
  });

  const backendTemplate = {
    metadata: {
      name: 'backend-engineer',
      title: 'Backend Engineer',
      description: '',
    },
    spec: {
      role: 'backend-engineer',
      phases: [
        {
          id: 'day1',
          tasks: [
            {
              id: 'be-task-1',
              phase: 'day1',
              title: 'Set up backend dev environment',
              description: '',
              type: 'manual',
              assignee: 'self',
              duePhase: 'day1',
            },
          ],
        },
      ],
    },
  };

  const managerTemplate = {
    metadata: {
      name: 'new-manager',
      title: 'New Manager',
      description: '',
    },
    spec: {
      role: 'new-manager',
      phases: [
        {
          id: 'day1',
          tasks: [
            {
              id: 'mgr-task-1',
              phase: 'day1',
              title: 'Complete manager training',
              description: '',
              type: 'manual',
              assignee: 'self',
              duePhase: 'day1',
            },
          ],
        },
      ],
    },
  };

  async function createApp(databaseId: 'SQLITE_3') {
    const knex = await databases.init(databaseId);
    const store = await DatabaseOnboardingStore.create({
      database: mockServices.database({ knex }),
    });

    const mockCatalogApi = {
      getEntities: jest.fn().mockResolvedValue({
        items: [backendTemplate, managerTemplate],
      }),
      getEntityByRef: jest.fn().mockImplementation(async () => ({
        kind: 'User',
        metadata: { name: 'new-joiner' },
      })),
      getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
    };

    const mockPermissions = {
      authorize: jest
        .fn()
        .mockResolvedValue([{ result: AuthorizeResult.ALLOW }]),
      authorizeConditional: jest.fn(),
    };

    const router = await createRouter({
      logger: mockServices.logger.mock(),
      config: new ConfigReader({
        onboarding: { defaults: { activeJoinerWindowDays: 90 } },
      }),
      store,
      draftStore: {
        getDraft: jest.fn(),
        upsertDraft: jest.fn(),
        markPublished: jest.fn(),
      } as any,
      permissions: mockPermissions as any,
      httpAuth: mockServices.httpAuth.mock({
        credentials: async () => mockCredentials.user('user:default/jane.doe'),
      }),
      catalogApi: mockCatalogApi as any,
    });

    return express().use(router).use(mockErrorHandler());
  }

  it.each(databases.eachSupportedId())(
    'keeps two assigned templates separate end-to-end, %p',
    async databaseId => {
      const app = await createApp(databaseId);
      const userRef = enc('user:default/new-joiner');

      // Assign both templates to the same user.
      const assignBackend = await request(app)
        .post(`/templates/backend-engineer/assign/${userRef}`)
        .set('Authorization', '******');
      expect(assignBackend.status).toBe(200);

      const assignManager = await request(app)
        .post(`/templates/new-manager/assign/${userRef}`)
        .set('Authorization', '******');
      expect(assignManager.status).toBe(200);

      // The full progress list must contain two separate records, not one
      // merged record.
      const listRes = await request(app)
        .get(`/progress/${userRef}`)
        .set('Authorization', '******');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(2);

      const byTemplate = new Map(
        listRes.body.map((p: any) => [p.templateName, p]),
      );
      expect(byTemplate.get('backend-engineer').tasks).toEqual([
        { taskId: 'be-task-1', status: 'pending' },
      ]);
      expect(byTemplate.get('new-manager').tasks).toEqual([
        { taskId: 'mgr-task-1', status: 'pending' },
      ]);

      // Completing the backend-engineer task must not affect new-manager's
      // checklist — this is the "switching shows a change" contract: each
      // template's progress is independently addressable and mutable.
      const updateRes = await request(app)
        .post(`/progress/${userRef}/tasks/be-task-1`)
        .set('Authorization', '******')
        .send({ status: 'done', templateName: 'backend-engineer' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.templateName).toBe('backend-engineer');
      expect(updateRes.body.tasks).toHaveLength(1);
      expect(updateRes.body.tasks[0]).toMatchObject({
        taskId: 'be-task-1',
        status: 'done',
      });

      const listAfterUpdate = await request(app)
        .get(`/progress/${userRef}`)
        .set('Authorization', '******');
      const byTemplateAfter = new Map(
        listAfterUpdate.body.map((p: any) => [p.templateName, p]),
      );
      // backend-engineer reflects the update...
      expect(byTemplateAfter.get('backend-engineer').tasks).toHaveLength(1);
      expect(byTemplateAfter.get('backend-engineer').tasks[0]).toMatchObject({
        taskId: 'be-task-1',
        status: 'done',
      });
      // ...while new-manager is completely untouched (still pending, still
      // its own distinct task list).
      expect(byTemplateAfter.get('new-manager').tasks).toEqual([
        { taskId: 'mgr-task-1', status: 'pending' },
      ]);
    },
  );
});
