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

import {
  OnboardingTask,
  OnboardingTemplate,
  TemplateValidationIssue,
} from '../types';

const PHASES = ['day1', 'week1', 'week2', 'month1'];
const TASK_TYPES = ['manual', 'automated'];

/**
 * Validates an OnboardingTemplate, returning a flat list of issues with
 * locator paths the editor can use to jump to the offending field.
 *
 * @public
 */
export function validateTemplate(
  template: OnboardingTemplate,
): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  const error = (path: string, message: string) =>
    issues.push({ path, message, severity: 'error' });

  if (!template.metadata?.name) {
    error('metadata.name', 'metadata.name is required');
  }
  if (!template.metadata?.title) {
    error('metadata.title', 'metadata.title is required');
  }
  if (!template.spec?.role) {
    error('spec.role', 'spec.role is required');
  }

  const phases = template.spec?.phases ?? [];
  const taskIds = new Set<string>();
  const allTasks: { task: OnboardingTask; path: string }[] = [];

  phases.forEach((phase, pi) => {
    if (!PHASES.includes(phase.id)) {
      error(
        `spec.phases[${pi}].id`,
        `Unknown phase "${phase.id}"; expected one of ${PHASES.join(', ')}`,
      );
    }

    (phase.tasks ?? []).forEach((task, ti) => {
      const taskPath = `spec.phases[${pi}].tasks[${ti}]`;
      allTasks.push({ task, path: taskPath });

      if (!task.id) {
        error(`${taskPath}.id`, 'Task id is required');
      } else if (taskIds.has(task.id)) {
        error(`${taskPath}.id`, `Duplicate task id "${task.id}"`);
      } else {
        taskIds.add(task.id);
      }

      if (!task.title) {
        error(`${taskPath}.title`, 'Task title is required');
      }
      if (task.phase && !PHASES.includes(task.phase)) {
        error(
          `${taskPath}.phase`,
          `Unknown phase "${task.phase}"; expected one of ${PHASES.join(', ')}`,
        );
      }
      if (task.duePhase && !PHASES.includes(task.duePhase)) {
        error(
          `${taskPath}.duePhase`,
          `Unknown duePhase "${task.duePhase}"; expected one of ${PHASES.join(
            ', ',
          )}`,
        );
      }
      if (task.type && !TASK_TYPES.includes(task.type)) {
        error(
          `${taskPath}.type`,
          `Unknown type "${task.type}"; expected one of ${TASK_TYPES.join(
            ', ',
          )}`,
        );
      }
      if (task.type === 'automated' && !task.automationRef) {
        error(
          `${taskPath}.automationRef`,
          'Automated tasks require an automationRef',
        );
      }
    });
  });

  // dependsOn references must exist.
  for (const { task, path } of allTasks) {
    (task.dependsOn ?? []).forEach((dep, di) => {
      if (!taskIds.has(dep)) {
        error(
          `${path}.dependsOn[${di}]`,
          `dependsOn references unknown task "${dep}" that does not exist`,
        );
      }
    });
  }

  // Cycle detection over the dependsOn graph.
  const graph = new Map<string, string[]>();
  for (const { task } of allTasks) {
    if (task.id) {
      graph.set(
        task.id,
        (task.dependsOn ?? []).filter(d => taskIds.has(d)),
      );
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const reported = new Set<string>();
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 'done') return false;
    if (s === 'visiting') return true;
    state.set(id, 'visiting');
    for (const next of graph.get(id) ?? []) {
      if (visit(next)) {
        if (!reported.has(id)) {
          reported.add(id);
          const found = allTasks.find(t => t.task.id === id);
          error(
            `${found?.path ?? 'spec'}.dependsOn`,
            `Dependency cycle detected involving task "${id}"`,
          );
        }
        return true;
      }
    }
    state.set(id, 'done');
    return false;
  };
  for (const id of graph.keys()) {
    visit(id);
  }

  return issues;
}
