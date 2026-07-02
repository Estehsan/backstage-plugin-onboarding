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
import { DatabaseOnboardingStore } from './OnboardingStore';

describe('DatabaseOnboardingStore buddy support', () => {
  const databases = TestDatabases.create({
    ids: ['SQLITE_3'],
    disableDocker: true,
  });

  it.each(databases.eachSupportedId())(
    'sets and retrieves a buddy for a user, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      const store = await DatabaseOnboardingStore.create({
        database: mockServices.database({ knex }),
      });

      await store.upsertProgress({
        userId: 'user:default/joiner',
        templateName: 'engineer-onboarding',
        startDate: '2026-07-01',
        tasks: [],
      });

      const updated = await store.setBuddy(
        'user:default/joiner',
        'user:default/buddy',
      );
      expect(updated).toBe(true);

      const progress = await store.getProgress('user:default/joiner');
      expect(progress?.buddyUserId).toBe('user:default/buddy');

      const buddyProgress = await store.getBuddyProgress('user:default/buddy');
      expect(buddyProgress).toHaveLength(1);
      expect(buddyProgress[0].userId).toBe('user:default/joiner');

      const clearedUpdated = await store.setBuddy(
        'user:default/joiner',
        undefined,
      );
      expect(clearedUpdated).toBe(true);
      const clearedProgress = await store.getProgress('user:default/joiner');
      expect(clearedProgress?.buddyUserId).toBeUndefined();
    },
  );

  it.each(databases.eachSupportedId())(
    'setBuddy returns false for an unknown user, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      const store = await DatabaseOnboardingStore.create({
        database: mockServices.database({ knex }),
      });

      const updated = await store.setBuddy(
        'user:default/unknown',
        'user:default/buddy',
      );
      expect(updated).toBe(false);
    },
  );

  it.each(databases.eachSupportedId())(
    'a task-status upsert does not clear an already-set buddy, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      const store = await DatabaseOnboardingStore.create({
        database: mockServices.database({ knex }),
      });

      await store.upsertProgress({
        userId: 'user:default/joiner',
        templateName: 'engineer-onboarding',
        startDate: '2026-07-01',
        tasks: [],
      });
      await store.setBuddy('user:default/joiner', 'user:default/buddy');

      // Simulate a later task-status update via the same upsert path.
      await store.upsertProgress({
        userId: 'user:default/joiner',
        templateName: 'engineer-onboarding',
        startDate: '2026-07-01',
        tasks: [{ taskId: 'task-1', status: 'done' }],
      });

      const progress = await store.getProgress('user:default/joiner');
      expect(progress?.buddyUserId).toBe('user:default/buddy');
      expect(progress?.tasks).toEqual([{ taskId: 'task-1', status: 'done' }]);
    },
  );
});
