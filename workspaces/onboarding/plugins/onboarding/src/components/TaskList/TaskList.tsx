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

import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import { TaskItem } from './TaskItem';
import { OnboardingTask, OnboardingProgress, Phase } from '../../types';
import { PHASE_LABELS, PHASE_ORDER } from '../../constants';

const spacing = 8;

const styles = {
  phaseSection: {
    marginBottom: spacing * 3,
  },
  phaseHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing,
    marginBottom: spacing,
  },
  phaseTitle: {
    fontWeight: 600,
  },
  countBadge: {
    height: 22,
    fontSize: '0.75rem',
  },
  taskPaper: {
    overflow: 'hidden',
  },
  emptyText: {
    padding: spacing * 2,
    color: '#666',
  },
};

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
          <Box key={phase.id} style={styles.phaseSection}>
            <Box style={styles.phaseHeader}>
              <Typography variant="h6" style={styles.phaseTitle}>
                {PHASE_LABELS[phase.id]}
              </Typography>
              <Chip
                label={`${doneCount} / ${phaseTasks.length} done`}
                style={styles.countBadge}
                size="small"
                color={doneCount === phaseTasks.length ? 'primary' : 'default'}
                variant="outlined"
              />
            </Box>

            <Paper style={styles.taskPaper} variant="outlined">
              {phaseTasks.length === 0 ? (
                <Typography style={styles.emptyText}>
                  No tasks in this phase
                </Typography>
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
            </Paper>
          </Box>
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
