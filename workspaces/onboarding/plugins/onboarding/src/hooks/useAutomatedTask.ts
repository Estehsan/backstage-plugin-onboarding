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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { onboardingApiRef } from '../api/OnboardingApi';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100; // ~5 minutes at 3s intervals

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

  // Tracks whether the component is still mounted so we never update state or
  // re-run callbacks after unmount.
  const mountedRef = useRef(true);

  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  // Clears (and forgets) any existing poll timer for a given task.
  const clearTaskTimer = useCallback((taskId: string) => {
    const timer = pollTimers.current.get(taskId);
    if (timer !== undefined) {
      clearInterval(timer);
      pollTimers.current.delete(taskId);
    }
  }, []);

  // Track mounted state and clean up all poll timers on unmount.
  useEffect(() => {
    mountedRef.current = true;
    const timers = pollTimers.current;
    return () => {
      mountedRef.current = false;
      for (const timer of timers.values()) {
        clearInterval(timer);
      }
      timers.clear();
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

        if (!mountedRef.current) return;

        setRunningTasks(prev => {
          const next = new Map(prev);
          next.set(taskId, { scaffolderTaskId, status: 'running' });
          return next;
        });

        // Clear any existing poll for this task so repeated triggers don't
        // accumulate overlapping intervals.
        clearTaskTimer(taskId);

        // Start polling for task completion. `attempts` lives in this closure
        // (one per poll), so it never goes stale across renders.
        let attempts = 0;
        const timer = setInterval(async () => {
          attempts += 1;
          if (attempts > MAX_POLL_ATTEMPTS) {
            clearTaskTimer(taskId);
            await onboardingApi
              .updateTaskStatus(
                userId,
                taskId,
                'blocked',
                `Automation timed out after ${Math.round(
                  (MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 60000,
                )} minutes`,
              )
              .catch(() => {});
            if (!mountedRef.current) return;
            setRunningTasks(prev => {
              const next = new Map(prev);
              next.set(taskId, { scaffolderTaskId, status: 'failed' });
              return next;
            });
            onProgressUpdate();
            return;
          }
          try {
            const scaffolderTask =
              await scaffolderApi.getTask(scaffolderTaskId);

            if (!mountedRef.current) {
              clearTaskTimer(taskId);
              return;
            }

            if (scaffolderTask.status === 'completed') {
              clearTaskTimer(taskId);

              await onboardingApi.updateTaskStatus(userId, taskId, 'done');

              if (!mountedRef.current) return;
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
              clearTaskTimer(taskId);

              await onboardingApi.updateTaskStatus(
                userId,
                taskId,
                'blocked',
                `Scaffolder task ${scaffolderTask.status}: ${scaffolderTaskId}`,
              );

              if (!mountedRef.current) return;
              setRunningTasks(prev => {
                const next = new Map(prev);
                next.set(taskId, { scaffolderTaskId, status: 'failed' });
                return next;
              });
              onProgressUpdate();
            }
          } catch (err) {
            // Transient polling error — keep polling, backend may recover.
            // eslint-disable-next-line no-console
            console.warn(
              `[useAutomatedTask] Polling scaffolder task ${scaffolderTaskId} failed (attempt ${attempts}/${MAX_POLL_ATTEMPTS}):`,
              err,
            );
          }
        }, POLL_INTERVAL_MS);

        pollTimers.current.set(taskId, timer);
        if (mountedRef.current) {
          onProgressUpdate();
        }
      } catch (error) {
        // Failed to even start: mark blocked
        await onboardingApi
          .updateTaskStatus(
            userId,
            taskId,
            'blocked',
            error instanceof Error
              ? error.message
              : 'Failed to start automation',
          )
          .catch(() => {});

        if (mountedRef.current) {
          onProgressUpdate();
        }
      }
    },
    [scaffolderApi, onboardingApi, userId, onProgressUpdate, clearTaskTimer],
  );

  const getAutomatedTaskStatus = useCallback(
    (taskId: string) => {
      return runningTasks.get(taskId);
    },
    [runningTasks],
  );

  return { triggerAutomatedTask, getAutomatedTaskStatus };
}
