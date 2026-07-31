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
import {
  DatabaseService,
  LoggerService,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { OnboardingTemplate, TemplateDraft, TemplateDraftRow } from '../types';

const migrationsDir = resolvePackagePath(
  '@estehsaan/backstage-plugin-onboarding-backend',
  'migrations',
);

/**
 * Persists Template Studio drafts in the `onboarding_template_drafts` table.
 * @public
 */
export class DatabaseTemplateDraftStore {
  private constructor(
    private readonly db: Knex,
    private readonly logger?: LoggerService,
  ) {}

  static async create(options: {
    database: DatabaseService;
    skipMigrations?: boolean;
    logger?: LoggerService;
  }): Promise<DatabaseTemplateDraftStore> {
    const { database, skipMigrations, logger } = options;
    const client = await database.getClient();

    if (!database.migrations?.skip && !skipMigrations) {
      await client.migrate.latest({ directory: migrationsDir });
    }

    return new DatabaseTemplateDraftStore(client, logger);
  }

  async getDraft(name: string): Promise<TemplateDraft | undefined> {
    const row = await this.db<TemplateDraftRow>('onboarding_template_drafts')
      .where('name', name)
      .first();

    if (!row) {
      return undefined;
    }

    return this.rowToDraft(row);
  }

  async upsertDraft(draft: TemplateDraft): Promise<void> {
    const specJson = JSON.stringify(draft.template);

    await this.db<TemplateDraftRow>('onboarding_template_drafts')
      .insert({
        name: draft.name,
        spec_json: specJson,
        source_location: draft.sourceLocation ?? null,
        updated_by: draft.updatedBy ?? null,
        updated_at: draft.updatedAt,
        status: draft.status,
      })
      .onConflict('name')
      .merge({
        spec_json: specJson,
        source_location: draft.sourceLocation ?? null,
        updated_by: draft.updatedBy ?? null,
        updated_at: draft.updatedAt,
        status: draft.status,
      });
  }

  async markPublished(name: string): Promise<void> {
    await this.db<TemplateDraftRow>('onboarding_template_drafts')
      .where('name', name)
      .update({ status: 'published' });
  }

  private rowToDraft(row: TemplateDraftRow): TemplateDraft {
    let template: OnboardingTemplate;
    try {
      template = JSON.parse(row.spec_json) as OnboardingTemplate;
    } catch (err) {
      this.logger?.warn(
        `Corrupt template draft "${row.name}": JSON parse failed`,
        { error: String(err) },
      );
      throw err;
    }

    return {
      name: row.name,
      template,
      sourceLocation: row.source_location ?? undefined,
      updatedBy: row.updated_by ?? undefined,
      updatedAt: row.updated_at,
      status: row.status === 'published' ? 'published' : 'draft',
    };
  }
}
