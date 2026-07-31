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
 * Creates the onboarding_template_drafts table, which stores in-progress edits
 * of OnboardingTemplate entities made through the Template Studio before they
 * are published to a git repository.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('onboarding_template_drafts', table => {
    table.string('name', 255).primary().notNullable();
    table.text('spec_json').notNullable();
    table.string('source_location', 1024).nullable();
    table.string('updated_by', 255).nullable();
    table.string('updated_at', 255).notNullable();
    table.string('status', 32).notNullable().defaultTo('draft');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('onboarding_template_drafts');
};
