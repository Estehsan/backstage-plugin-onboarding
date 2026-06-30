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
import {
  Checkbox,
  TagGroup,
  Tag,
  Text,
  TooltipTrigger,
  Tooltip,
  ButtonIcon,
} from '@backstage/ui';
import Avatar from '@material-ui/core/Avatar';
import {
  RiLock2Line,
  RiExternalLinkLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiBookLine,
} from '@remixicon/react';
import { OnboardingTask, TaskStatus } from '../../types';
import { PHASE_LABELS } from '../../constants';
import { TaskDetailPanel } from './TaskDetailPanel';
import styles from './TaskItem.module.css';

function getAssigneeInitials(assignee: string): string {
  if (assignee === 'self') return 'ME';
  if (assignee === 'buddy') return 'BD';
  if (assignee === 'manager') return 'MG';
  return assignee
    .split(/[\s/:]/)
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** @public */
export interface TaskItemProps {
  task: OnboardingTask;
  status: TaskStatus;
  locked: boolean;
  lockedByNames?: string[];
  onToggle: (taskId: string) => void;
}

/** @public */
export function TaskItem(props: TaskItemProps) {
  const { task, status, locked, lockedByNames, onToggle } = props;
  const [expanded, setExpanded] = useState(false);

  const isDone = status === 'done';
  const isBlocked = status === 'blocked';
  const isAutomated = task.type === 'automated';

  const hasDetail =
    !!task.documentation ||
    (task.resources && task.resources.length > 0) ||
    (task.recommendations && task.recommendations.length > 0);

  const rootClassName = [
    styles.root,
    isBlocked && styles.blocked,
    locked && styles.locked,
  ]
    .filter(Boolean)
    .join(' ');

  const handleToggle = () => {
    if (!locked) {
      onToggle(task.id);
    }
  };

  const checkbox = (
    <div className={styles.checkbox}>
      <Checkbox
        isSelected={isDone}
        isDisabled={locked}
        onChange={handleToggle}
        aria-label={`Mark "${task.title}" as complete`}
      />
    </div>
  );

  const handleExpandToggle = () => {
    if (hasDetail) setExpanded(prev => !prev);
  };

  return (
    <div className={styles.wrapper} data-testid={`task-item-${task.id}`}>
      <div className={rootClassName}>
        {locked ? (
          <TooltipTrigger>
            <span style={{ display: 'flex', alignItems: 'flex-start' }}>
              <RiLock2Line className={styles.lockIcon} size={18} />
              {checkbox}
            </span>
            <Tooltip>
              {lockedByNames && lockedByNames.length > 0
                ? `Requires: ${lockedByNames.join(', ')}`
                : 'Dependencies not yet complete'}
            </Tooltip>
          </TooltipTrigger>
        ) : (
          checkbox
        )}

        <div
          className={`${styles.content}${hasDetail ? ` ${styles.clickableContent}` : ''}`}
          onClick={handleExpandToggle}
          role={hasDetail ? 'button' : undefined}
          tabIndex={hasDetail ? 0 : undefined}
          onKeyDown={
            hasDetail
              ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleExpandToggle();
                  }
                }
              : undefined
          }
        >
          <div className={styles.titleRow}>
            <Text
              variant="body-medium"
              className={isDone ? styles.titleDone : styles.title}
            >
              {task.title}
            </Text>
            {hasDetail && (
              <TagGroup aria-label="Task documentation">
                <Tag
                  className={styles.hasDocsBadge}
                  size="small"
                  icon={<RiBookLine size={14} />}
                >
                  Guide
                </Tag>
              </TagGroup>
            )}
          </div>

          <Text variant="body-small" className={styles.description}>
            {task.description}
          </Text>

          <TagGroup aria-label="Task badges" className={styles.badges}>
            <Tag className={styles.phaseBadge} size="small">
              {PHASE_LABELS[task.duePhase] ?? task.duePhase}
            </Tag>
            <Tag className={styles.typeBadge} size="small">
              {isAutomated ? 'Automated' : 'Manual'}
            </Tag>
            {isBlocked && (
              <Tag className={styles.blockedBadge} size="small">
                Blocked
              </Tag>
            )}
            {isAutomated && (
              <Tag className={styles.automatedChip} size="small">
                {status === 'in-progress' ? 'Running' : status}
              </Tag>
            )}
          </TagGroup>
        </div>

        <div className={styles.actions}>
          <TooltipTrigger>
            <Avatar className={styles.avatar}>
              {getAssigneeInitials(task.assignee)}
            </Avatar>
            <Tooltip>{task.assignee}</Tooltip>
          </TooltipTrigger>
          {task.link && (
            <TooltipTrigger>
              <a
                href={task.link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={task.link.label}
              >
                <ButtonIcon
                  size="small"
                  variant="tertiary"
                  icon={<RiExternalLinkLine size={18} />}
                />
              </a>
              <Tooltip>{task.link.label}</Tooltip>
            </TooltipTrigger>
          )}
          {hasDetail && (
            <TooltipTrigger>
              <ButtonIcon
                size="small"
                variant="tertiary"
                className={styles.expandButton}
                onPress={handleExpandToggle}
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
                icon={
                  expanded ? (
                    <RiArrowUpSLine size={18} />
                  ) : (
                    <RiArrowDownSLine size={18} />
                  )
                }
              />
              <Tooltip>{expanded ? 'Hide guide' : 'View guide'}</Tooltip>
            </TooltipTrigger>
          )}
        </div>
      </div>
      <TaskDetailPanel task={task} open={expanded} />
    </div>
  );
}
