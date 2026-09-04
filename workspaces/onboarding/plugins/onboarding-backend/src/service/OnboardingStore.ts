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

import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import {
  DatabaseService,
  LoggerService,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { OnboardingProgress, OnboardingProgressRow } from '../types';

const migrationsDir = resolvePackagePath(
  '@estehsaan/backstage-plugin-onboarding-backend',
  'migrations',
);

/** @public */
export class DatabaseOnboardingStore {
  private constructor(
    private readonly db: Knex,
    private readonly logger?: LoggerService,
  ) {}

  static async create(options: {
    database: DatabaseService;
    skipMigrations?: boolean;
    logger?: LoggerService;
  }): Promise<DatabaseOnboardingStore> {
    const { database, skipMigrations, logger } = options;
    const client = await database.getClient();

    if (!database.migrations?.skip && !skipMigrations) {
      await client.migrate.latest({
        directory: migrationsDir,
      });
    }

    return new DatabaseOnboardingStore(client, logger);
  }

  // Spec 001 FR-002: return ALL of a user's progress records (one per assigned
  // template), not just a single row keyed by user_id.
  // Spec 001 FR-005: order deterministically by template_name so the frontend's
  // default-selected checklist (progressList[0]) is stable across page loads
  // instead of depending on unspecified row order.
  async listProgress(userId: string): Promise<OnboardingProgress[]> {
    const rows = await this.db<OnboardingProgressRow>('onboarding_progress')
      .where('user_id', userId)
      .orderBy('template_name')
      .select();
    return rows.map(row => this.rowToProgress(row));
  }

  // Spec 001 FR-004: fetch a single record by its (user, template) composite key so a
  // task update targets exactly one template.
  async getProgress(
    userId: string,
    templateName: string,
  ): Promise<OnboardingProgress | undefined> {
    const row = await this.db<OnboardingProgressRow>('onboarding_progress')
      .where({ user_id: userId, template_name: templateName })
      .first();
    return row ? this.rowToProgress(row) : undefined;
  }

  // Spec 001 FR-003 / SC-002: create a new progress row for (user, template) only if
  // one does not already exist; never overwrite an existing row's task state. Returns
  // the persisted record (existing or newly created).
  async createProgressIfAbsent(
    progress: OnboardingProgress,
  ): Promise<OnboardingProgress> {
    const tasksJson = JSON.stringify(progress.tasks);
    const now = this.db.fn.now() as unknown as string;
    await this.db<OnboardingProgressRow>('onboarding_progress')
      .insert({
        id: uuid(),
        user_id: progress.userId,
        template_name: progress.templateName,
        start_date: progress.startDate,
        tasks: tasksJson,
        updated_at: now,
      })
      // Spec 001 FR-003: do NOT merge on conflict — leave the existing (user, template)
      // row untouched so re-assigning a template preserves task completion.
      .onConflict(['user_id', 'template_name'])
      .ignore();

    const saved = await this.getProgress(
      progress.userId,
      progress.templateName,
    );
    // saved is always defined here (either the pre-existing row or the one just
    // inserted).
    return saved ?? progress;
  }

  async upsertProgress(progress: OnboardingProgress): Promise<void> {
    const tasksJson = JSON.stringify(progress.tasks);
    const now = this.db.fn.now() as unknown as string;

    // Use INSERT … ON CONFLICT DO UPDATE to avoid a TOCTOU race where two
    // concurrent requests both see no row and both try to INSERT.
    await this.db<OnboardingProgressRow>('onboarding_progress')
      .insert({
        id: uuid(),
        user_id: progress.userId,
        template_name: progress.templateName,
        start_date: progress.startDate,
        tasks: tasksJson,
        updated_at: now,
      })
      // Spec 001 FR-001: conflict on (user_id, template_name), not user_id alone, so
      // updating one template never clobbers another. Merge only tasks + updated_at so
      // start_date and buddy_user_id are preserved.
      .onConflict(['user_id', 'template_name'])
      .merge({
        tasks: tasksJson,
        updated_at: now,
      });
  }

  async getTeamProgress(userIds: string[]): Promise<OnboardingProgress[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await this.db<OnboardingProgressRow>('onboarding_progress')
      .whereIn('user_id', userIds)
      .select();

    return rows.map(row => this.rowToProgress(row));
  }

  async setBuddy(
    userId: string,
    buddyUserId: string | undefined,
  ): Promise<boolean> {
    const updated = await this.db<OnboardingProgressRow>('onboarding_progress')
      .where('user_id', userId)
      .update({ buddy_user_id: buddyUserId ?? null });
    return updated > 0;
  }

  async getBuddyProgress(buddyUserId: string): Promise<OnboardingProgress[]> {
    const rows = await this.db<OnboardingProgressRow>('onboarding_progress')
      .where('buddy_user_id', buddyUserId)
      .select();

    return rows.map(row => this.rowToProgress(row));
  }

  private rowToProgress(row: OnboardingProgressRow): OnboardingProgress {
    let tasks: OnboardingProgress['tasks'];
    try {
      const parsed = JSON.parse(row.tasks);
      if (!Array.isArray(parsed)) {
        this.logger?.warn(
          `Corrupt task data for user "${row.user_id}" in onboarding_progress: tasks column is not an array — returning empty`,
        );
        tasks = [];
      } else {
        tasks = parsed;
      }
    } catch (err) {
      this.logger?.warn(
        `Corrupt task data for user "${row.user_id}" in onboarding_progress: JSON parse failed — returning empty`,
        { error: String(err) },
      );
      tasks = [];
    }
    return {
      userId: row.user_id,
      templateName: row.template_name,
      startDate: row.start_date,
      tasks,
      buddyUserId: row.buddy_user_id ?? undefined,
    };
  }
}
