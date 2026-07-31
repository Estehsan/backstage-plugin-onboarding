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

import { TestDatabases, mockServices } from '@backstage/backend-test-utils';
import { OnboardingTemplate } from '../types';
import { DatabaseTemplateDraftStore } from './TemplateDraftStore';

const template: OnboardingTemplate = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: { name: 'engineer', title: 'Engineer' },
  spec: { role: 'engineer', phases: [] },
};

describe('DatabaseTemplateDraftStore', () => {
  const databases = TestDatabases.create({
    ids: ['SQLITE_3'],
    disableDocker: true,
  });

  it.each(databases.eachSupportedId())(
    'upserts, reads, and publishes a draft, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      const store = await DatabaseTemplateDraftStore.create({
        database: mockServices.database({ knex }),
      });

      await store.upsertDraft({
        name: 'engineer',
        template,
        sourceLocation: 'url:https://github.com/o/r/blob/main/eng.yaml',
        updatedBy: 'user:default/lead',
        updatedAt: '2026-08-01T00:00:00.000Z',
        status: 'draft',
      });

      const loaded = await store.getDraft('engineer');
      expect(loaded?.template.metadata.title).toBe('Engineer');
      expect(loaded?.sourceLocation).toBe(
        'url:https://github.com/o/r/blob/main/eng.yaml',
      );
      expect(loaded?.status).toBe('draft');

      await store.upsertDraft({
        name: 'engineer',
        template: {
          ...template,
          metadata: { ...template.metadata, title: 'Senior Engineer' },
        },
        updatedAt: '2026-08-01T01:00:00.000Z',
        status: 'draft',
      });
      expect((await store.getDraft('engineer'))?.template.metadata.title).toBe(
        'Senior Engineer',
      );

      await store.markPublished('engineer');
      expect((await store.getDraft('engineer'))?.status).toBe('published');

      expect(await store.getDraft('missing')).toBeUndefined();
    },
  );
});
