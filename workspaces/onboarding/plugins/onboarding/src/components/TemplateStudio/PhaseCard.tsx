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

import { Button, Flex, Text } from '@backstage/ui';
import { OnboardingTask, Phase } from '../../types';
import { TaskCard } from './TaskCard';
import styles from './TemplateStudio.module.css';

/** @public */
export interface PhaseCardProps {
  phase: Phase;
  phaseIndex: number;
  tasks: OnboardingTask[];
  onChangeTask: (index: number, patch: Partial<OnboardingTask>) => void;
  onRemoveTask: (index: number) => void;
  onAddTask: () => void;
}

/**
 * Groups the tasks of a single phase and lets authors add or edit tasks
 * within it.
 */
export function PhaseCard(props: PhaseCardProps) {
  const { phase, phaseIndex, tasks, onChangeTask, onRemoveTask, onAddTask } =
    props;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <Text variant="title-small">{phase}</Text>
        <Button variant="secondary" size="small" onPress={() => onAddTask()}>
          Add task
        </Button>
      </div>
      <Flex direction="column" gap="3">
        {tasks.map((task, index) => (
          <TaskCard
            key={`${task.id}-${index}`}
            task={task}
            fieldPath={`spec.phases[${phaseIndex}].tasks[${index}]`}
            onChange={patch => onChangeTask(index, patch)}
            onRemove={() => onRemoveTask(index)}
          />
        ))}
        {tasks.length === 0 && (
          <Text variant="body-small">No tasks in this phase yet.</Text>
        )}
      </Flex>
    </div>
  );
}
