/*
 * Copyright 2026 The Backstage Authors
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

// @ts-check

/**
 * Spec 001 FR-001: allow multiple OnboardingProgress records per user (one per
 * assigned template). Replaces the single-column UNIQUE(user_id) constraint with a
 * composite UNIQUE(user_id, template_name) so assigning a second template creates a
 * new row instead of colliding with (and overwriting) the first.
 *
 * Backward compatible (SC-003): every existing row already has a distinct user_id, so
 * it also satisfies the stricter composite key — no data is rewritten or lost.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('onboarding_progress', table => {
    table.dropUnique(['user_id'], 'onboarding_progress_user_id_unique');
    table.unique(['user_id', 'template_name'], {
      indexName: 'onboarding_progress_user_template_unique',
    });
    // Re-add a plain index on user_id for list-by-user lookups (listProgress).
    table.index(['user_id'], 'onboarding_progress_user_id_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('onboarding_progress', table => {
    table.dropIndex(['user_id'], 'onboarding_progress_user_id_idx');
    table.dropUnique(
      ['user_id', 'template_name'],
      'onboarding_progress_user_template_unique',
    );
    table.unique(['user_id'], {
      indexName: 'onboarding_progress_user_id_unique',
    });
  });
};
