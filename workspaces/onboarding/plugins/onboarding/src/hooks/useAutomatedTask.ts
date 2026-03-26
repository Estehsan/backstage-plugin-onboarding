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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { onboardingApiRef } from '../api/OnboardingApi';

const POLL_INTERVAL_MS = 3000;

/**
 * Hook to manage scaffolder-based automated task execution.
 * Triggers a scaffolder template and polls for completion, then updates the task status.
 */
export function useAutomatedTask(options: {
  userId: string;
  onProgressUpdate: () => void;
}) {
  const { userId, onProgressUpdate } = options;
  const scaffolderApi = useApi(scaffolderApiRef);
  const onboardingApi = useApi(onboardingApiRef);

  const [runningTasks, setRunningTasks] = useState<
    Map<string, { scaffolderTaskId: string; status: 'running' | 'failed' }>
  >(new Map());

  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  // Clean up poll timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of pollTimers.current.values()) {
        clearInterval(timer);
      }
    };
  }, []);

  const triggerAutomatedTask = useCallback(
    async (taskId: string, automationRef: string) => {
      try {
        // Mark as in-progress in the onboarding backend
        await onboardingApi.updateTaskStatus(userId, taskId, 'in-progress');

        // Trigger the scaffolder template
        const { taskId: scaffolderTaskId } = await scaffolderApi.scaffold({
          templateRef: `template:default/${automationRef}`,
          values: { userId },
        });

        setRunningTasks(prev => {
          const next = new Map(prev);
          next.set(taskId, { scaffolderTaskId, status: 'running' });
          return next;
        });

        // Start polling for task completion
        const timer = setInterval(async () => {
          try {
            const scaffolderTask =
              await scaffolderApi.getTask(scaffolderTaskId);

            if (scaffolderTask.status === 'completed') {
              clearInterval(timer);
              pollTimers.current.delete(taskId);

              await onboardingApi.updateTaskStatus(userId, taskId, 'done');

              setRunningTasks(prev => {
                const next = new Map(prev);
                next.delete(taskId);
                return next;
              });
              onProgressUpdate();
            } else if (
              scaffolderTask.status === 'failed' ||
              scaffolderTask.status === 'cancelled'
            ) {
              clearInterval(timer);
              pollTimers.current.delete(taskId);

              await onboardingApi.updateTaskStatus(
                userId,
                taskId,
                'blocked',
                `Scaffolder task ${scaffolderTask.status}: ${scaffolderTaskId}`,
              );

              setRunningTasks(prev => {
                const next = new Map(prev);
                next.set(taskId, { scaffolderTaskId, status: 'failed' });
                return next;
              });
              onProgressUpdate();
            }
          } catch {
            // Polling error — keep polling, it may recover
          }
        }, POLL_INTERVAL_MS);

        pollTimers.current.set(taskId, timer);
        onProgressUpdate();
      } catch (error) {
        // Failed to even start: mark blocked
        await onboardingApi
          .updateTaskStatus(
            userId,
            taskId,
            'blocked',
            error instanceof Error ? error.message : 'Failed to start automation',
          )
          .catch(() => {});

        onProgressUpdate();
      }
    },
    [scaffolderApi, onboardingApi, userId, onProgressUpdate],
  );

  const getAutomatedTaskStatus = useCallback(
    (taskId: string) => {
      return runningTasks.get(taskId);
    },
    [runningTasks],
  );

  return { triggerAutomatedTask, getAutomatedTaskStatus };
}
