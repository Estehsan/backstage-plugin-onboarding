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
  Phase,
  TemplateBlock,
} from '../../types';

/** Ordered list of phases used to seed empty phase pickers. */
export const PHASES: Phase[] = ['day1', 'week1', 'week2', 'month1'];

/** Generates a stable-ish unique task id from a title. */
export function slugifyTaskId(title: string, existing: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'task';
  let candidate = base;
  let i = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

/** Returns the set of all task ids currently used in the template. */
export function collectTaskIds(template: OnboardingTemplate): Set<string> {
  return new Set(
    template.spec.phases.flatMap(p => p.tasks.map(t => t.id)).filter(Boolean),
  );
}

/** Immutably updates the template metadata. */
export function updateMetadata(
  template: OnboardingTemplate,
  patch: Partial<OnboardingTemplate['metadata']>,
): OnboardingTemplate {
  return { ...template, metadata: { ...template.metadata, ...patch } };
}

/** Immutably updates a scalar spec field (role/team). */
export function updateSpecField(
  template: OnboardingTemplate,
  patch: Partial<Pick<OnboardingTemplate['spec'], 'role' | 'team'>>,
): OnboardingTemplate {
  return { ...template, spec: { ...template.spec, ...patch } };
}

/** Ensures a phase exists and returns the updated template. */
export function ensurePhase(
  template: OnboardingTemplate,
  phase: Phase,
): OnboardingTemplate {
  if (template.spec.phases.some(p => p.id === phase)) {
    return template;
  }
  return {
    ...template,
    spec: {
      ...template.spec,
      phases: [...template.spec.phases, { id: phase, tasks: [] }],
    },
  };
}

/** Immutably replaces a task at the given phase/index. */
export function updateTask(
  template: OnboardingTemplate,
  phase: Phase,
  index: number,
  patch: Partial<OnboardingTask>,
): OnboardingTemplate {
  return {
    ...template,
    spec: {
      ...template.spec,
      phases: template.spec.phases.map(p =>
        p.id === phase
          ? {
              ...p,
              tasks: p.tasks.map((t, i) =>
                i === index ? { ...t, ...patch } : t,
              ),
            }
          : p,
      ),
    },
  };
}

/** Immutably removes a task at the given phase/index. */
export function removeTask(
  template: OnboardingTemplate,
  phase: Phase,
  index: number,
): OnboardingTemplate {
  return {
    ...template,
    spec: {
      ...template.spec,
      phases: template.spec.phases.map(p =>
        p.id === phase
          ? { ...p, tasks: p.tasks.filter((_, i) => i !== index) }
          : p,
      ),
    },
  };
}

/** Appends a fresh empty task to a phase. */
export function addTask(
  template: OnboardingTemplate,
  phase: Phase,
): OnboardingTemplate {
  const withPhase = ensurePhase(template, phase);
  const ids = collectTaskIds(withPhase);
  const task: OnboardingTask = {
    id: slugifyTaskId('new-task', ids),
    phase,
    title: 'New task',
    description: '',
    type: 'manual',
    assignee: 'self',
    duePhase: phase,
  };
  return {
    ...withPhase,
    spec: {
      ...withPhase.spec,
      phases: withPhase.spec.phases.map(p =>
        p.id === phase ? { ...p, tasks: [...p.tasks, task] } : p,
      ),
    },
  };
}

/** Inserts a library block (single task or a full phase of tasks). */
export function insertBlock(
  template: OnboardingTemplate,
  block: TemplateBlock,
): OnboardingTemplate {
  const ids = collectTaskIds(template);
  if (block.kind === 'task' && block.task) {
    const phase = block.task.phase;
    const withPhase = ensurePhase(template, phase);
    const task: OnboardingTask = {
      ...block.task,
      id: slugifyTaskId(block.task.title, ids),
    };
    return {
      ...withPhase,
      spec: {
        ...withPhase.spec,
        phases: withPhase.spec.phases.map(p =>
          p.id === phase ? { ...p, tasks: [...p.tasks, task] } : p,
        ),
      },
    };
  }

  if (block.kind === 'phase' && block.tasks) {
    let next = template;
    for (const partial of block.tasks) {
      const phase = partial.phase ?? block.phase ?? 'day1';
      next = ensurePhase(next, phase);
      const currentIds = collectTaskIds(next);
      const task: OnboardingTask = {
        ...partial,
        phase,
        id: slugifyTaskId(partial.title, currentIds),
      };
      next = {
        ...next,
        spec: {
          ...next.spec,
          phases: next.spec.phases.map(p =>
            p.id === phase ? { ...p, tasks: [...p.tasks, task] } : p,
          ),
        },
      };
    }
    return next;
  }

  return template;
}
