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

import { Box, Text, Card, CardBody, Flex, TagGroup, Tag } from '@backstage/ui';
import { TaskItem } from './TaskItem';
import { OnboardingTask, OnboardingProgress, Phase } from '../../types';
import { PHASE_LABELS, PHASE_ORDER } from '../../constants';
import styles from './TaskList.module.css';

/** @public */
export interface TaskListProps {
  phases: {
    id: Phase;
    tasks: OnboardingTask[];
  }[];
  progress: OnboardingProgress;
  onToggle: (taskId: string) => void;
}

/** @public */
export function TaskList(props: TaskListProps) {
  const { phases, progress, onToggle } = props;

  const allTasks = phases.flatMap(p => p.tasks);

  const sortedPhases = [...phases].sort(
    (a, b) => PHASE_ORDER.indexOf(a.id) - PHASE_ORDER.indexOf(b.id),
  );

  return (
    <Box>
      {sortedPhases.map(phase => {
        const phaseTasks = phase.tasks;
        const doneCount = phaseTasks.filter(t => {
          const taskProgress = progress.tasks.find(tp => tp.taskId === t.id);
          return taskProgress?.status === 'done';
        }).length;

        return (
          <div key={phase.id} className={styles.phaseSection}>
            <Flex align="center" gap="2" className={styles.phaseHeader}>
              <Text variant="title-small" className={styles.phaseTitle}>
                {PHASE_LABELS[phase.id]}
              </Text>
              <TagGroup>
                <Tag size="small">
                  {`${doneCount} / ${phaseTasks.length} done`}
                </Tag>
              </TagGroup>
            </Flex>

            <Card className={styles.taskPaper}>
              <CardBody>
                {phaseTasks.length === 0 ? (
                  <Text variant="body-medium" className={styles.emptyText}>
                    No tasks in this phase
                  </Text>
                ) : (
                  phaseTasks.map(task => {
                    const taskProgress = progress.tasks.find(
                      tp => tp.taskId === task.id,
                    );
                    const status = taskProgress?.status ?? 'pending';

                    const locked = isTaskLocked(task, progress);
                    const lockedByNames = locked
                      ? getLockedByNames(task, progress, allTasks)
                      : undefined;

                    return (
                      <TaskItem
                        key={task.id}
                        task={task}
                        status={status}
                        locked={locked}
                        lockedByNames={lockedByNames}
                        onToggle={onToggle}
                      />
                    );
                  })
                )}
              </CardBody>
            </Card>
          </div>
        );
      })}
    </Box>
  );
}

function isTaskLocked(
  task: OnboardingTask,
  progress: OnboardingProgress,
): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return false;
  }

  return task.dependsOn.some(depId => {
    const depProgress = progress.tasks.find(tp => tp.taskId === depId);
    return !depProgress || depProgress.status !== 'done';
  });
}

function getLockedByNames(
  task: OnboardingTask,
  progress: OnboardingProgress,
  allTasks: OnboardingTask[],
): string[] {
  if (!task.dependsOn) return [];

  return task.dependsOn
    .filter(depId => {
      const depProgress = progress.tasks.find(tp => tp.taskId === depId);
      return !depProgress || depProgress.status !== 'done';
    })
    .map(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask?.title ?? depId;
    });
}
