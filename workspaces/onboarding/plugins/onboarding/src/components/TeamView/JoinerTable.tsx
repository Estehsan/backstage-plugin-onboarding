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

import { Fragment, useState } from 'react';
import { Text, Tag, TagGroup, ButtonIcon } from '@backstage/ui';
import Button from '@material-ui/core/Button';
import Collapse from '@material-ui/core/Collapse';
import LinearProgress from '@material-ui/core/LinearProgress';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { TeamJoinerSummary } from '../../types';
import styles from './TeamView.module.css';

function daysSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** @public */
export interface JoinerTableProps {
  joiners: TeamJoinerSummary[];
  showBuddyColumn?: boolean;
  onAssignBuddy?: (joiner: TeamJoinerSummary) => void;
}

/** @public */
export function JoinerTable(props: JoinerTableProps) {
  const { joiners, showBuddyColumn = false, onAssignBuddy } = props;
  const [expandedRow, setExpandedRow] = useState<string | undefined>();

  // Spec 001 FR-006: userId is no longer unique in the roster (one row per
  // template), so key rows and expansion state by (userId, templateName).
  const rowKey = (j: TeamJoinerSummary) => `${j.userId}::${j.templateName}`;

  const handleRowExpand = (key: string) => {
    setExpandedRow(expandedRow === key ? undefined : key);
  };

  const totalColumns = showBuddyColumn ? 8 : 6;

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Days Since Start</TableCell>
            <TableCell className={styles.progressCell}>Progress</TableCell>
            <TableCell>Blocked</TableCell>
            {showBuddyColumn && (
              <>
                <TableCell>Buddy</TableCell>
                <TableCell />
              </>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {joiners.map(joiner => (
            <Fragment key={rowKey(joiner)}>
              <TableRow hover>
                <TableCell
                  padding="checkbox"
                  onClick={() => handleRowExpand(rowKey(joiner))}
                  style={{ cursor: 'pointer' }}
                >
                  <ButtonIcon size="small" variant="tertiary">
                    {expandedRow === rowKey(joiner) ? (
                      <RiArrowUpSLine size={18} />
                    ) : (
                      <RiArrowDownSLine size={18} />
                    )}
                  </ButtonIcon>
                </TableCell>
                <TableCell
                  onClick={() => handleRowExpand(rowKey(joiner))}
                  style={{ cursor: 'pointer' }}
                >
                  {joiner.displayName}
                </TableCell>
                <TableCell
                  onClick={() => handleRowExpand(rowKey(joiner))}
                  style={{ cursor: 'pointer' }}
                >
                  {joiner.role}
                </TableCell>
                <TableCell
                  onClick={() => handleRowExpand(rowKey(joiner))}
                  style={{ cursor: 'pointer' }}
                >
                  {daysSince(joiner.startDate)} days
                </TableCell>
                <TableCell
                  onClick={() => handleRowExpand(rowKey(joiner))}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.progressCell}>
                    <LinearProgress
                      className={styles.progressBar}
                      variant="determinate"
                      value={joiner.completionPercent}
                    />
                    <Text variant="body-small">
                      {joiner.completionPercent}%
                    </Text>
                  </div>
                </TableCell>
                <TableCell
                  onClick={() => handleRowExpand(rowKey(joiner))}
                  style={{ cursor: 'pointer' }}
                >
                  {joiner.blockedTaskCount > 0 ? (
                    <TagGroup aria-label="Blocked task count">
                      <Tag size="small" className={styles.blockedTag}>
                        {joiner.blockedTaskCount}
                      </Tag>
                    </TagGroup>
                  ) : (
                    <Text variant="body-small">0</Text>
                  )}
                </TableCell>
                {showBuddyColumn && (
                  <>
                    <TableCell>{joiner.buddyDisplayName ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => onAssignBuddy?.(joiner)}
                      >
                        Assign Buddy
                      </Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
              <TableRow>
                <TableCell
                  colSpan={totalColumns}
                  style={{ paddingBottom: 0, paddingTop: 0 }}
                >
                  <Collapse
                    in={expandedRow === rowKey(joiner)}
                    timeout="auto"
                    unmountOnExit
                  >
                    <div className={styles.expandedDetail}>
                      <Text variant="title-small">
                        Blocked tasks for {joiner.displayName}
                      </Text>
                      {joiner.blockedTaskCount > 0 ? (
                        <Text variant="body-small" className={styles.helpText}>
                          {joiner.blockedTaskCount} task(s) are currently
                          blocked. View their individual checklist for details.
                        </Text>
                      ) : (
                        <Text variant="body-small" className={styles.helpText}>
                          No blocked tasks.
                        </Text>
                      )}
                    </div>
                  </Collapse>
                </TableCell>
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
