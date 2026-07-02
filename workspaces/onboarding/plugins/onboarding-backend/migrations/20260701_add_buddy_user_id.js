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
 * Adds a nullable buddy_user_id column to onboarding_progress so a manually
 * assigned onboarding buddy can be tracked per user, independent of the
 * assigned template.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('onboarding_progress', table => {
    table.string('buddy_user_id', 255).nullable();
    table.index(['buddy_user_id'], 'onboarding_progress_buddy_user_id_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('onboarding_progress', table => {
    table.dropIndex(['buddy_user_id'], 'onboarding_progress_buddy_user_id_idx');
    table.dropColumn('buddy_user_id');
  });
};
