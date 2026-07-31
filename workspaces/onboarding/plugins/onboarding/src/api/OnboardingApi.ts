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

import { createApiRef } from '@backstage/core-plugin-api';
import {
  OnboardingCatalogUser,
  OnboardingProgress,
  OnboardingTemplate,
  PublishTemplateRequest,
  PublishTemplateResponse,
  TaskStatus,
  TeamJoinerSummary,
  TeamOnboardingStats,
  TemplateBlock,
  TemplateDraft,
  TemplateValidationIssue,
} from '../types';

/**
 * API ref for the Onboarding plugin service.
 * @public
 */
export const onboardingApiRef = createApiRef<OnboardingApi>({
  id: 'plugin.onboarding.service',
});

/**
 * API interface for the Onboarding plugin.
 * @public
 */
export interface OnboardingApi {
  /** Retrieves the onboarding progress for a given user. */
  getProgress(userId: string): Promise<OnboardingProgress>;
  /** Updates the status of a specific onboarding task for a user. */
  updateTaskStatus(
    userId: string,
    taskId: string,
    status: TaskStatus,
    blockedReason?: string,
  ): Promise<OnboardingProgress>;
  /** Retrieves onboarding completion statistics for a team. */
  getTeamStats(teamName: string): Promise<TeamOnboardingStats>;
  /** Retrieves all available onboarding templates. */
  getTemplates(): Promise<OnboardingTemplate[]>;
  /** Assigns an onboarding template to a user. */
  assignTemplate(
    templateName: string,
    userId: string,
    buddyUserId?: string,
  ): Promise<OnboardingProgress>;
  /** Searches catalog users to support template assignment. */
  searchCatalogUsers(query: string): Promise<OnboardingCatalogUser[]>;
  /** Sets the buddy for a user's onboarding. */
  setBuddy(userId: string, buddyUserId: string | undefined): Promise<void>;
  /** Retrieves the teams the current user belongs to. */
  getMyTeams(): Promise<{ teams: string[] }>;
  /** Retrieves the list of users the current user is buddying. */
  getMyBuddies(): Promise<TeamJoinerSummary[]>;
  /** Checks if the current user has template assigner permissions. */
  getIsAssigner(): Promise<{ isAssigner: boolean }>;
  /** Loads the editable draft for a template, seeding from catalog if needed. */
  getTemplateDraft(name: string): Promise<TemplateDraft>;
  /** Persists an edited template draft after server-side validation. */
  saveTemplateDraft(
    name: string,
    template: OnboardingTemplate,
    sourceLocation?: string,
  ): Promise<TemplateDraft>;
  /** Creates a new empty template draft for the given role. */
  createTemplateDraft(input: {
    name: string;
    role: string;
    title: string;
  }): Promise<TemplateDraft>;
  /** Lists the reusable task and phase blocks available in the studio. */
  listBlocks(): Promise<TemplateBlock[]>;
  /** Validates a template without persisting it. */
  validateTemplate(
    name: string,
    template: OnboardingTemplate,
  ): Promise<TemplateValidationIssue[]>;
  /** Publishes a template draft as a pull/merge request. */
  publishTemplate(
    name: string,
    request: PublishTemplateRequest,
  ): Promise<PublishTemplateResponse>;
}
