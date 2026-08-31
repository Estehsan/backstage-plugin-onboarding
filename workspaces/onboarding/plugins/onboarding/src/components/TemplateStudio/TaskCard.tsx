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

import { useState } from 'react';
import { Button, ButtonIcon, Flex, Select, TextField } from '@backstage/ui';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
} from '@remixicon/react';
import { OnboardingTask, Phase } from '../../types';
import { DocumentationField } from './DocumentationField';
import { PHASES } from './templateOps';
import styles from './TemplateStudio.module.css';

/** @public */
export interface TaskCardProps {
  task: OnboardingTask;
  fieldPath: string;
  onChange: (patch: Partial<OnboardingTask>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const PHASE_OPTIONS = PHASES.map(p => ({ value: p, label: p }));
const TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'automated', label: 'Automated' },
];

/**
 * Structured editor for a single onboarding task, including an inline
 * documentation editor powered by the TechDocs Editor markdown component.
 */
export function TaskCard(props: TaskCardProps) {
  const {
    task,
    fieldPath,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = props;
  const [showDocs, setShowDocs] = useState(false);

  return (
    <div className={styles.taskCard} data-field-path={fieldPath}>
      <div className={styles.cardHeader}>
        <TextField
          aria-label="Task title"
          label="Title"
          value={task.title}
          onChange={value => onChange({ title: value })}
        />
        <ButtonIcon
          icon={<RiArrowUpLine />}
          variant="tertiary"
          aria-label="Move task up"
          isDisabled={!canMoveUp}
          onPress={() => onMoveUp()}
        />
        <ButtonIcon
          icon={<RiArrowDownLine />}
          variant="tertiary"
          aria-label="Move task down"
          isDisabled={!canMoveDown}
          onPress={() => onMoveDown()}
        />
        <ButtonIcon
          icon={<RiDeleteBinLine />}
          variant="tertiary"
          aria-label="Remove task"
          onPress={() => onRemove()}
        />
      </div>

      <TextField
        aria-label="Task description"
        label="Description"
        value={task.description}
        onChange={value => onChange({ description: value })}
      />

      <div className={styles.row}>
        <Select
          aria-label="Task type"
          label="Type"
          options={TYPE_OPTIONS}
          selectedKey={task.type}
          onSelectionChange={key =>
            onChange({ type: key as OnboardingTask['type'] })
          }
        />
        <TextField
          aria-label="Task assignee"
          label="Assignee"
          value={task.assignee}
          onChange={value => onChange({ assignee: value })}
        />
        <Select
          aria-label="Task due phase"
          label="Due phase"
          options={PHASE_OPTIONS}
          selectedKey={task.duePhase}
          onSelectionChange={key => onChange({ duePhase: key as Phase })}
        />
      </div>

      {task.type === 'automated' && (
        <TextField
          aria-label="Automation ref"
          label="Automation ref (scaffolder template)"
          value={task.automationRef ?? ''}
          onChange={value => onChange({ automationRef: value })}
        />
      )}

      <Flex gap="2">
        <Button
          variant="tertiary"
          size="small"
          onPress={() => setShowDocs(current => !current)}
        >
          {showDocs ? 'Hide documentation' : 'Edit documentation'}
        </Button>
      </Flex>

      {showDocs && (
        <DocumentationField
          value={task.documentation ?? ''}
          onChange={markdown => onChange({ documentation: markdown })}
        />
      )}
    </div>
  );
}
