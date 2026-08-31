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

/**
 * Status of a single onboarding task.
 * @public
 */
export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked';

/**
 * Whether a task is completed manually or triggered via a Scaffolder template.
 * @public
 */
export type TaskType = 'manual' | 'automated';

/**
 * Onboarding phase identifier.
 * @public
 */
export type Phase = 'day1' | 'week1' | 'week2' | 'month1';

/**
 * Type of a learning or reference resource attached to a task.
 * @public
 */
export type ResourceType =
  | 'video'
  | 'doc'
  | 'article'
  | 'course'
  | 'repo'
  | 'tool';

/**
 * A reference resource attached to an onboarding task.
 * @public
 */
export interface TaskResource {
  /** Resource category. */
  type: ResourceType;
  /** Display label for the resource. */
  title: string;
  /** URL to the resource. */
  url: string;
  /** Optional human-readable duration (e.g. "20 min"). */
  duration?: string;
}

/**
 * A single item within an onboarding template phase.
 * @public
 */
export interface OnboardingTask {
  /** Unique task identifier within the template. */
  id: string;
  /** Phase this task belongs to. */
  phase: Phase;
  /** Short display title. */
  title: string;
  /** Longer description shown in the detail panel. */
  description: string;
  /** Whether the task is completed manually or via automation. */
  type: TaskType;
  /** Who is responsible for completing the task. */
  assignee: 'self' | 'buddy' | 'manager' | string;
  /** IDs of tasks that must be done first. */
  dependsOn?: string[];
  /** Scaffolder template ref for automated tasks. */
  automationRef?: string;
  /** Optional external link shown alongside the task. */
  link?: { label: string; url: string };
  /** Phase by which this task should be completed. */
  duePhase: Phase;
  /** Estimated time in minutes. */
  estimatedMinutes?: number;
  /** Long-form documentation rendered in the detail panel. */
  documentation?: string;
  /** Supplementary learning resources. */
  resources?: TaskResource[];
  /** Helpful tips or recommendations. */
  recommendations?: string[];
}

/**
 * A catalog OnboardingTemplate entity describing a role-based checklist.
 * @public
 */
export interface OnboardingTemplate {
  /** Catalog API version for onboarding templates. */
  apiVersion: 'onboarding.backstage.io/v1';
  /** Entity kind. */
  kind: 'OnboardingTemplate';
  /** Standard Backstage entity metadata. */
  metadata: {
    name: string;
    title: string;
    description?: string;
  };
  /** Template specification containing phases and tasks. */
  spec: {
    role: string;
    team?: string;
    phases: {
      id: Phase;
      tasks: OnboardingTask[];
    }[];
  };
}

/**
 * Persisted onboarding progress record for a user.
 * @public
 */
export interface OnboardingProgress {
  /** Backstage user entity ref (e.g. "user:default/jane"). */
  userId: string;
  /** Name of the assigned OnboardingTemplate. */
  templateName: string;
  /** ISO-8601 timestamp when onboarding started. */
  startDate: string;
  /** Per-task status rows. */
  tasks: {
    taskId: string;
    status: TaskStatus;
    completedAt?: string;
    blockedReason?: string;
  }[];
  /** Backstage user entity ref of the assigned onboarding buddy, if any. */
  buddyUserId?: string;
}

/**
 * Summary of a single joiner's onboarding progress, used in team rosters
 * and buddy views.
 * @public
 */
export interface TeamJoinerSummary {
  /** Backstage user entity ref of the joiner. */
  userId: string;
  /** Human-readable display name of the joiner. */
  displayName: string;
  /** Role/template name assigned to the joiner. */
  role: string;
  /** ISO-8601 timestamp when onboarding started. */
  startDate: string;
  /** Percentage of tasks completed (0-100). */
  completionPercent: number;
  /** Count of currently blocked tasks. */
  blockedTaskCount: number;
  /** Backstage user entity ref of the joiner's assigned buddy, if any. */
  buddyUserId?: string;
  /** Human-readable display name of the joiner's buddy, if any. */
  buddyDisplayName?: string;
}

/**
 * Aggregated onboarding statistics for a team.
 * @public
 */
export interface TeamOnboardingStats {
  /** Team name. */
  teamName: string;
  /** Active joiners with their progress details. */
  activeJoiners: TeamJoinerSummary[];
  /** Average completion percentage across all active joiners. */
  avgCompletionPercent: number;
  /** Total number of blocked tasks across the team. */
  totalBlockedTasks: number;
}

/**
 * A reusable fragment users can insert while editing a template in the
 * Template Studio — either a single task or a whole phase of tasks.
 * @public
 */
export interface TemplateBlock {
  /** Unique identifier of the block within the library. */
  id: string;
  /** Whether the block inserts a single task or a full phase. */
  kind: 'task' | 'phase';
  /** Display label shown in the block library. */
  title: string;
  /** Optional longer description of what the block adds. */
  description?: string;
  /** Target phase for a `phase` block. */
  phase?: Phase;
  /** Task payload for a `task` block (id is assigned on insertion). */
  task?: Omit<OnboardingTask, 'id'>;
  /** Task payloads for a `phase` block (ids are assigned on insertion). */
  tasks?: Omit<OnboardingTask, 'id'>[];
}

/**
 * An in-progress edit of an OnboardingTemplate persisted in the backend before
 * being published to a git repository.
 * @public
 */
export interface TemplateDraft {
  /** Template name (matches `metadata.name`). */
  name: string;
  /** The full template being edited. */
  template: OnboardingTemplate;
  /** Catalog location the template was seeded from, if any (used on publish). */
  sourceLocation?: string;
  /** Backstage user entity ref of the last editor, if known. */
  updatedBy?: string;
  /** ISO-8601 timestamp of the last edit. */
  updatedAt: string;
  /** Whether the draft is still being edited or has been published. */
  status: 'draft' | 'published';
}

/**
 * A single problem found when validating a template.
 * @public
 */
export interface TemplateValidationIssue {
  /**
   * Locator for the offending field, e.g. `spec.phases[0].tasks[1].dependsOn`,
   * used by the editor to navigate to the problem.
   */
  path: string;
  /** Human-readable description of the problem. */
  message: string;
  /** Whether the issue blocks publishing or is only advisory. */
  severity: 'error' | 'warning';
}

/**
 * Request body for publishing a template draft as a pull/merge request.
 * @public
 */
export interface PublishTemplateRequest {
  /** Pull/merge request title. */
  title: string;
  /** Optional PR/MR description body. */
  description?: string;
  /** Optional commit message (defaults to the title). */
  commitMessage?: string;
  /** Branch to merge into (defaults to the repo's default branch). */
  baseBranch?: string;
  /** Open the PR/MR as a draft. */
  draft?: boolean;
  /** Usernames to request review from. */
  reviewers?: string[];
  /** Target repository URL — required when the draft has no source location. */
  repoUrl?: string;
  /** Target file path within the repo — required for new templates. */
  filePath?: string;
}

/**
 * Result of publishing a template draft.
 * @public
 */
export interface PublishTemplateResponse {
  /** Direct URL to the opened pull/merge request. */
  url: string;
  /** Provider-specific PR/MR number. */
  number: number;
}

/**
 * Content payload for a single file change in a publish operation.
 * Field-compatible with techdocs-editor-node's VcsWriteFile.
 * @public
 */
export interface OnboardingVcsWriteFile {
  content: string;
  encoding?: 'utf8' | 'base64';
  mimeType?: string;
}

/**
 * Options for opening a pull/merge request when publishing a template draft.
 * Field-compatible with techdocs-editor-node's OpenPrOptions.
 * @public
 */
export interface OnboardingOpenPrOptions {
  repoUrl: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  description?: string;
  /** Map of file path to new content (null = delete). */
  files: Map<string, OnboardingVcsWriteFile | null>;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
  draft?: boolean;
  reviewers?: string[];
}

/**
 * Result of opening a pull/merge request.
 * Field-compatible with techdocs-editor-node's OpenPrResult.
 * @public
 */
export interface OnboardingOpenPrResult {
  url: string;
  number: number;
}

/**
 * The minimal version-control surface the onboarding publish endpoint needs.
 *
 * Deliberately a structural subset of techdocs-editor-node's `VcsProvider`, so an
 * app can register a real `VcsProvider` instance directly (it satisfies this
 * interface). Defined here — not in `-backend` — so both the router type and any
 * companion backend module can share it without a `-backend` import.
 * @public
 */
export interface OnboardingVcsProvider {
  /** Returns the default branch name (e.g. 'main'). */
  getDefaultBranch(repoUrl: string): Promise<string>;
  /** Opens a pull/merge request with the given file changes. */
  openPullRequest(
    opts: OnboardingOpenPrOptions,
  ): Promise<OnboardingOpenPrResult>;
}
