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

import { useEffect, useState, Fragment } from 'react';
import { Box, Text, Tag, TagGroup, ButtonIcon } from '@backstage/ui';
import Collapse from '@material-ui/core/Collapse';
import LinearProgress from '@material-ui/core/LinearProgress';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import { RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { InfoCard } from '@backstage/core-components';
import { OnboardingApi } from '../../api/OnboardingApi';
import { TeamOnboardingStats } from '../../types';
import styles from './TeamView.module.css';

function daysSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** @public */
export interface TeamViewProps {
  onboardingApi: OnboardingApi;
}

/** @public */
export function TeamView(props: TeamViewProps) {
  const { onboardingApi } = props;

  const [teamName, setTeamName] = useState('');
  const [stats, setStats] = useState<TeamOnboardingStats | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [expandedRow, setExpandedRow] = useState<string | undefined>();

  const handleSearch = async () => {
    if (!teamName.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await onboardingApi.getTeamStats(teamName.trim());
      setStats(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStats(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamName) {
      const timer = setTimeout(handleSearch, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamName]);

  const handleRowExpand = (userId: string) => {
    setExpandedRow(expandedRow === userId ? undefined : userId);
  };

  return (
    <Box>
      <TextField
        className={styles.searchField}
        label="Team name"
        variant="outlined"
        size="small"
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
        placeholder="e.g. platform"
        fullWidth
      />

      {loading && <LinearProgress />}

      {error && (
        <Text variant="body-small" className={styles.errorText}>
          {error}
        </Text>
      )}

      {stats && (
        <>
          <div className={styles.statsGrid}>
            <InfoCard title="Active Joiners" variant="gridItem">
              <Text variant="title-medium" className={styles.statValue}>
                {stats.activeJoiners.length}
              </Text>
              <Text variant="body-small" className={styles.statLabel}>
                currently onboarding
              </Text>
            </InfoCard>
            <InfoCard title="Avg. Completion" variant="gridItem">
              <Text variant="title-medium" className={styles.statValue}>
                {stats.avgCompletionPercent}%
              </Text>
              <Text variant="body-small" className={styles.statLabel}>
                across all joiners
              </Text>
            </InfoCard>
            <InfoCard title="Blocked Tasks" variant="gridItem">
              <Text variant="title-medium" className={styles.statValue}>
                {stats.totalBlockedTasks}
              </Text>
              <Text variant="body-small" className={styles.statLabel}>
                need attention
              </Text>
            </InfoCard>
          </div>

          {stats.activeJoiners.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Days Since Start</TableCell>
                    <TableCell className={styles.progressCell}>
                      Progress
                    </TableCell>
                    <TableCell>Blocked</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.activeJoiners.map(joiner => (
                    <Fragment key={joiner.userId}>
                      <TableRow
                        hover
                        onClick={() => handleRowExpand(joiner.userId)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <ButtonIcon size="small" variant="tertiary">
                            {expandedRow === joiner.userId ? (
                              <RiArrowUpSLine size={18} />
                            ) : (
                              <RiArrowDownSLine size={18} />
                            )}
                          </ButtonIcon>
                        </TableCell>
                        <TableCell>{joiner.displayName}</TableCell>
                        <TableCell>{joiner.role}</TableCell>
                        <TableCell>
                          {daysSince(joiner.startDate)} days
                        </TableCell>
                        <TableCell>
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
                        <TableCell>
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
                      </TableRow>
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          style={{ paddingBottom: 0, paddingTop: 0 }}
                        >
                          <Collapse
                            in={expandedRow === joiner.userId}
                            timeout="auto"
                            unmountOnExit
                          >
                            <div className={styles.expandedDetail}>
                              <Text variant="title-small">
                                Blocked tasks for {joiner.displayName}
                              </Text>
                              {joiner.blockedTaskCount > 0 ? (
                                <Text
                                  variant="body-small"
                                  className={styles.helpText}
                                >
                                  {joiner.blockedTaskCount} task(s) are
                                  currently blocked. View their individual
                                  checklist for details.
                                </Text>
                              ) : (
                                <Text
                                  variant="body-small"
                                  className={styles.helpText}
                                >
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
          ) : (
            <Text variant="body-small" className={styles.helpText}>
              No active joiners found for team &quot;{stats.teamName}&quot;.
            </Text>
          )}
        </>
      )}

      {!stats && !loading && !error && (
        <Text variant="body-small" className={styles.helpText}>
          Enter a team name to view onboarding stats.
        </Text>
      )}
    </Box>
  );
}
