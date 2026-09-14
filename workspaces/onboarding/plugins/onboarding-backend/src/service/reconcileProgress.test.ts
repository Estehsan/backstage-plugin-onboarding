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
  OnboardingProgress,
  OnboardingTask,
  OnboardingTemplate,
} from '../types';
import {
  reconcileProgressTasks,
  toPersistableProgress,
} from './reconcileProgress';

function makeTemplate(taskIds: string[]): OnboardingTemplate {
  return {
    apiVersion: 'onboarding.backstage.io/v1',
    kind: 'OnboardingTemplate',
    metadata: { name: 'backend-engineer-platform', title: 'BE' },
    spec: {
      role: 'backend-engineer',
      phases: [
        {
          id: 'day1',
          tasks: taskIds.map(
            (id): OnboardingTask => ({
              id,
              phase: 'day1',
              title: id,
              description: '',
              type: 'manual',
              assignee: 'self',
              duePhase: 'day1',
            }),
          ),
        },
      ],
    },
  };
}

function makeProgress(tasks: OnboardingProgress['tasks']): OnboardingProgress {
  return {
    userId: 'user:default/jane.doe',
    templateName: 'backend-engineer-platform',
    startDate: '2026-03-01T00:00:00.000Z',
    tasks,
  };
}

describe('reconcileProgressTasks', () => {
  it('adds template tasks that are missing from the snapshot as pending', () => {
    const progress = makeProgress([{ taskId: 'setup-laptop', status: 'done' }]);

    const result = reconcileProgressTasks(
      progress,
      makeTemplate(['setup-laptop', 'devex-kt-sessions']),
    );

    expect(result.progress.tasks).toEqual([
      { taskId: 'setup-laptop', status: 'done' },
      { taskId: 'devex-kt-sessions', status: 'pending' },
    ]);
    expect(result.orphanTasks).toEqual([]);
  });

  it('preserves existing statuses and timestamps verbatim', () => {
    const progress = makeProgress([
      {
        taskId: 'setup-laptop',
        status: 'done',
        completedAt: '2026-03-02T10:00:00.000Z',
      },
      {
        taskId: 'meet-buddy',
        status: 'blocked',
        blockedReason: 'waiting on IT',
      },
    ]);

    const result = reconcileProgressTasks(
      progress,
      makeTemplate(['setup-laptop', 'meet-buddy', 'devex-kt-sessions']),
    );

    expect(result.progress.tasks[0]).toEqual({
      taskId: 'setup-laptop',
      status: 'done',
      completedAt: '2026-03-02T10:00:00.000Z',
    });
    expect(result.progress.tasks[1]).toEqual({
      taskId: 'meet-buddy',
      status: 'blocked',
      blockedReason: 'waiting on IT',
    });
  });

  it('returns the tasks in template order', () => {
    const progress = makeProgress([
      { taskId: 'meet-buddy', status: 'done' },
      { taskId: 'setup-laptop', status: 'pending' },
    ]);

    const result = reconcileProgressTasks(
      progress,
      makeTemplate(['setup-laptop', 'meet-buddy']),
    );

    expect(result.progress.tasks.map(t => t.taskId)).toEqual([
      'setup-laptop',
      'meet-buddy',
    ]);
  });

  it('separates tasks removed from the template as orphans and keeps them persistable', () => {
    const progress = makeProgress([
      { taskId: 'setup-laptop', status: 'pending' },
      {
        taskId: 'legacy-task',
        status: 'done',
        completedAt: '2026-03-02T10:00:00.000Z',
      },
    ]);

    const result = reconcileProgressTasks(
      progress,
      makeTemplate(['setup-laptop']),
    );

    expect(result.progress.tasks.map(t => t.taskId)).toEqual(['setup-laptop']);
    expect(result.orphanTasks).toEqual([
      {
        taskId: 'legacy-task',
        status: 'done',
        completedAt: '2026-03-02T10:00:00.000Z',
      },
    ]);
    expect(
      toPersistableProgress(result.progress, result.orphanTasks).tasks.map(
        t => t.taskId,
      ),
    ).toEqual(['setup-laptop', 'legacy-task']);
  });

  it('preserves a snapshot that already matches the template', () => {
    const progress = makeProgress([
      { taskId: 'setup-laptop', status: 'done' },
      { taskId: 'meet-buddy', status: 'pending' },
    ]);

    const result = reconcileProgressTasks(
      progress,
      makeTemplate(['setup-laptop', 'meet-buddy']),
    );

    expect(result.progress.tasks).toEqual(progress.tasks);
  });

  it('is idempotent when reconciling a persisted result', () => {
    const progress = makeProgress([
      { taskId: 'legacy-task', status: 'done' },
      { taskId: 'setup-laptop', status: 'pending' },
    ]);
    const template = makeTemplate(['setup-laptop', 'devex-kt-sessions']);

    const first = reconcileProgressTasks(progress, template);
    const second = reconcileProgressTasks(
      toPersistableProgress(first.progress, first.orphanTasks),
      template,
    );

    expect(second.progress.tasks).toEqual(first.progress.tasks);
    expect(second.orphanTasks).toEqual(first.orphanTasks);
  });

  it('leaves the record untouched when the template cannot be resolved', () => {
    const progress = makeProgress([{ taskId: 'setup-laptop', status: 'done' }]);

    const result = reconcileProgressTasks(progress, undefined);

    expect(result.progress).toBe(progress);
    expect(result.orphanTasks).toEqual([]);
  });

  it('leaves the record untouched when the template has no tasks', () => {
    const progress = makeProgress([{ taskId: 'setup-laptop', status: 'done' }]);

    const result = reconcileProgressTasks(progress, makeTemplate([]));

    expect(result.progress).toBe(progress);
  });
});
