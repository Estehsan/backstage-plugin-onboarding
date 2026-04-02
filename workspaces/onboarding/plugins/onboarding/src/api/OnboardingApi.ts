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
  OnboardingProgress,
  OnboardingTemplate,
  TaskStatus,
  TeamOnboardingStats,
} from '../types';

/** @public */
export const onboardingApiRef = createApiRef<OnboardingApi>({
  id: 'plugin.onboarding.service',
});

/** @public */
export interface OnboardingApi {
  getProgress(userId: string): Promise<OnboardingProgress>;
  updateTaskStatus(
    userId: string,
    taskId: string,
    status: TaskStatus,
    blockedReason?: string,
  ): Promise<OnboardingProgress>;
  getTeamStats(teamName: string): Promise<TeamOnboardingStats>;
  getTemplates(): Promise<OnboardingTemplate[]>;
  assignTemplate(
    templateName: string,
    userId: string,
  ): Promise<OnboardingProgress>;
}
