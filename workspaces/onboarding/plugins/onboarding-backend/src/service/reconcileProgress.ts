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

import { OnboardingProgress, OnboardingTemplate } from '../types';

/** A single per-task status row of a stored progress record. */
type TaskProgress = OnboardingProgress['tasks'][number];

/** Result of reconciling a stored progress record against its live template. */
export interface ReconciledProgress {
  /** The record as the API should present it: exactly the live template's tasks. */
  progress: OnboardingProgress;
  /**
   * Rows whose task id is no longer in the template. Hidden from the API
   * response but kept so callers can persist them and not lose history.
   */
  orphanTasks: TaskProgress[];
}

/**
 * Projects a stored snapshot onto the live template's task order, adding new
 * tasks as pending and preserving existing state. Removed tasks are kept
 * separately so writes retain their history for a later re-add.
 */
export function reconcileProgressTasks(
  progress: OnboardingProgress,
  template: OnboardingTemplate | undefined,
): ReconciledProgress {
  if (!template) {
    return { progress, orphanTasks: [] };
  }

  const templateTaskIds = new Set(
    template.spec.phases.flatMap(phase => phase.tasks.map(task => task.id)),
  );

  if (templateTaskIds.size === 0) {
    // Preserve compatibility with empty templates: leave the snapshot intact.
    return { progress, orphanTasks: [] };
  }

  const storedById = new Map<string, TaskProgress>();
  for (const task of progress.tasks) {
    if (!storedById.has(task.taskId)) {
      storedById.set(task.taskId, task);
    }
  }

  const tasks = Array.from(
    templateTaskIds,
    (taskId): TaskProgress =>
      storedById.get(taskId) ?? {
        taskId,
        status: 'pending',
      },
  );
  const orphanTasks = progress.tasks.filter(
    task => !templateTaskIds.has(task.taskId),
  );

  return { progress: { ...progress, tasks }, orphanTasks };
}

/**
 * The full row to persist for a reconciled record: the template's tasks plus
 * the retained orphan rows.
 */
export function toPersistableProgress(
  progress: OnboardingProgress,
  orphanTasks: TaskProgress[],
): OnboardingProgress {
  return {
    ...progress,
    tasks: [...progress.tasks, ...orphanTasks],
  };
}
