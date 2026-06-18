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

import { useState, type CSSProperties } from 'react';
import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import Avatar from '@material-ui/core/Avatar';
import LockIcon from '@material-ui/icons/Lock';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import { OnboardingTask, TaskStatus } from '../../types';
import { PHASE_LABELS } from '../../constants';
import { TaskDetailPanel } from './TaskDetailPanel';

const spacing = 8;

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: `${spacing * 1.5}px ${spacing * 2}px`,
    borderLeft: '4px solid transparent',
  },
  blocked: {
    borderLeftColor: '#d32f2f',
  },
  locked: {
    opacity: 0.5,
  },
  checkbox: {
    padding: `0 ${spacing}px 0 0`,
    marginTop: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing,
    flexWrap: 'wrap',
  },
  title: {
    fontWeight: 500,
  },
  titleDone: {
    fontWeight: 500,
    textDecoration: 'line-through',
    color: '#666',
  },
  description: {
    marginTop: spacing * 0.5,
    color: '#666',
  },
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing * 0.5,
    marginTop: spacing * 0.5,
  },
  phaseBadge: {
    height: 20,
    fontSize: '0.7rem',
  },
  typeBadge: {
    height: 20,
    fontSize: '0.7rem',
  },
  blockedBadge: {
    height: 20,
    fontSize: '0.7rem',
    backgroundColor: '#d32f2f',
    color: '#fff',
  },
  automatedChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  avatar: {
    width: 28,
    height: 28,
    fontSize: '0.75rem',
    marginLeft: spacing,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: spacing,
  },
  lockIcon: {
    fontSize: 18,
    color: '#bdbdbd',
    marginRight: spacing * 0.5,
    marginTop: 4,
  },
  wrapper: {
    borderBottom: '1px solid #e0e0e0',
  },
  expandButton: {
    padding: spacing * 0.5,
    marginLeft: spacing * 0.5,
  },
  hasDocsBadge: {
    height: 20,
    fontSize: '0.7rem',
    cursor: 'pointer',
  },
  clickableContent: {
    cursor: 'pointer',
  },
};

const AUTOMATED_STATUS_COLORS: Record<
  string,
  'default' | 'primary' | 'secondary'
> = {
  pending: 'default',
  'in-progress': 'primary',
  done: 'default',
  blocked: 'secondary',
};

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

  const rootStyle = {
    ...styles.root,
    ...(isBlocked && styles.blocked),
    ...(locked && styles.locked),
  };

  const handleToggle = () => {
    if (!locked) {
      onToggle(task.id);
    }
  };

  const checkbox = (
    <Checkbox
      style={styles.checkbox}
      checked={isDone}
      disabled={locked}
      onChange={handleToggle}
      color="primary"
      size="small"
      inputProps={{ 'aria-label': `Mark "${task.title}" as complete` }}
    />
  );

  const handleExpandToggle = () => {
    if (hasDetail) setExpanded(prev => !prev);
  };

  return (
    <Box style={styles.wrapper} data-testid={`task-item-${task.id}`}>
      <Box style={rootStyle}>
        {locked ? (
          <Tooltip
            title={
              lockedByNames && lockedByNames.length > 0
                ? `Requires: ${lockedByNames.join(', ')}`
                : 'Dependencies not yet complete'
            }
          >
            <span style={{ display: 'flex', alignItems: 'flex-start' }}>
              <LockIcon style={styles.lockIcon} />
              {checkbox}
            </span>
          </Tooltip>
        ) : (
          checkbox
        )}

        <Box
          style={{
            ...styles.content,
            ...(hasDetail && styles.clickableContent),
          }}
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
          <Box style={styles.titleRow}>
            <Typography
              variant="body1"
              style={isDone ? styles.titleDone : styles.title}
            >
              {task.title}
            </Typography>
            {hasDetail && (
              <Chip
                icon={<MenuBookIcon style={{ fontSize: 14 }} />}
                label="Guide"
                style={styles.hasDocsBadge}
                size="small"
                variant="outlined"
                color="primary"
                onClick={handleExpandToggle}
              />
            )}
          </Box>

          <Typography variant="body2" style={styles.description}>
            {task.description}
          </Typography>

          <Box style={styles.badges}>
            <Chip
              label={PHASE_LABELS[task.duePhase] ?? task.duePhase}
              style={styles.phaseBadge}
              size="small"
              variant="outlined"
            />
            <Chip
              label={isAutomated ? 'Automated' : 'Manual'}
              style={styles.typeBadge}
              size="small"
              variant="outlined"
              color={isAutomated ? 'primary' : 'default'}
            />
            {isBlocked && (
              <Chip label="Blocked" style={styles.blockedBadge} size="small" />
            )}
            {isAutomated && (
              <Chip
                label={status === 'in-progress' ? 'Running' : status}
                style={styles.automatedChip}
                size="small"
                color={AUTOMATED_STATUS_COLORS[status] ?? 'default'}
              />
            )}
          </Box>
        </Box>

        <Box style={styles.actions}>
          <Tooltip title={task.assignee}>
            <Avatar style={styles.avatar}>
              {getAssigneeInitials(task.assignee)}
            </Avatar>
          </Tooltip>
          {task.link && (
            <Tooltip title={task.link.label}>
              <IconButton
                size="small"
                href={task.link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={task.link.label}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasDetail && (
            <Tooltip title={expanded ? 'Hide guide' : 'View guide'}>
              <IconButton
                size="small"
                style={styles.expandButton}
                onClick={handleExpandToggle}
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
              >
                {expanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
      <TaskDetailPanel task={task} open={expanded} />
    </Box>
  );
}
