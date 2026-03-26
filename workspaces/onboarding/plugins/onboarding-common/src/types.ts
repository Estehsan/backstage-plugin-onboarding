/*
 * Copyright 2024 Ehsan Tehrani
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

/** @public */
export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked';

/** @public */
export type TaskType = 'manual' | 'automated';

/** @public */
export type Phase = 'day1' | 'week1' | 'week2' | 'month1';

/** @public */
export type ResourceType =
  | 'video'
  | 'doc'
  | 'article'
  | 'course'
  | 'repo'
  | 'tool';

/** @public */
export interface TaskResource {
  type: ResourceType;
  title: string;
  url: string;
  duration?: string;
}

/** @public */
export interface OnboardingTask {
  id: string;
  phase: Phase;
  title: string;
  description: string;
  type: TaskType;
  assignee: 'self' | 'buddy' | 'manager' | string;
  dependsOn?: string[];
  automationRef?: string;
  link?: { label: string; url: string };
  duePhase: Phase;
  estimatedMinutes?: number;
  documentation?: string;
  resources?: TaskResource[];
  recommendations?: string[];
}

/** @public */
export interface OnboardingTemplate {
  apiVersion: 'onboarding.backstage.io/v1';
  kind: 'OnboardingTemplate';
  metadata: {
    name: string;
    title: string;
    description?: string;
  };
  spec: {
    role: string;
    team?: string;
    phases: {
      id: Phase;
      tasks: OnboardingTask[];
    }[];
  };
}

/** @public */
export interface OnboardingProgress {
  userId: string;
  templateName: string;
  startDate: string;
  tasks: {
    taskId: string;
    status: TaskStatus;
    completedAt?: string;
    blockedReason?: string;
  }[];
}

/** @public */
export interface TeamOnboardingStats {
  teamName: string;
  activeJoiners: {
    userId: string;
    displayName: string;
    role: string;
    startDate: string;
    completionPercent: number;
    blockedTaskCount: number;
  }[];
  avgCompletionPercent: number;
  totalBlockedTasks: number;
}
