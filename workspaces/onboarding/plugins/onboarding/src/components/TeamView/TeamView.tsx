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

import { useCallback, useEffect, useState, Fragment } from 'react';
import { Box, Text, Tag, TagGroup, ButtonIcon } from '@backstage/ui';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Collapse from '@material-ui/core/Collapse';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import LinearProgress from '@material-ui/core/LinearProgress';
import MenuItem from '@material-ui/core/MenuItem';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { InfoCard } from '@backstage/core-components';
import { OnboardingApi } from '../../api/OnboardingApi';
import {
  TeamOnboardingStats,
  TeamJoinerSummary,
  OnboardingCatalogUser,
} from '../../types';
import styles from './TeamView.module.css';

function daysSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** @public */
export interface TeamViewProps {
  onboardingApi: OnboardingApi;
  isAssigner: boolean;
}

/** @public */
export function TeamView(props: TeamViewProps) {
  const { onboardingApi, isAssigner } = props;

  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [stats, setStats] = useState<TeamOnboardingStats | undefined>();
  const [myBuddies, setMyBuddies] = useState<TeamJoinerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [expandedRow, setExpandedRow] = useState<string | undefined>();

  // Buddy assignment dialog state
  const [assigningBuddyFor, setAssigningBuddyFor] = useState<
    TeamJoinerSummary | undefined
  >();
  const [buddyOptions, setBuddyOptions] = useState<OnboardingCatalogUser[]>([]);
  const [buddySearchLoading, setBuddySearchLoading] = useState(false);
  const [buddyInputValue, setBuddyInputValue] = useState('');
  const [selectedBuddy, setSelectedBuddy] =
    useState<OnboardingCatalogUser | null>(null);
  const [assigningBuddy, setAssigningBuddy] = useState(false);
  const [assignError, setAssignError] = useState<string | undefined>();

  // Determine view mode on mount
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        setLoading(true);
        const [teamsResult, buddiesResult] = await Promise.allSettled([
          onboardingApi.getMyTeams(),
          onboardingApi.getMyBuddies(),
        ]);

        if (cancelled) return;

        let teamsData: string[] = [];
        let buddiesData: TeamJoinerSummary[] = [];

        if (teamsResult.status === 'fulfilled') {
          teamsData = teamsResult.value.teams;
        }

        if (buddiesResult.status === 'fulfilled') {
          buddiesData = buddiesResult.value;
        }

        setTeams(teamsData);
        setMyBuddies(buddiesData);

        // If in assigner mode with teams, default to first team
        if (isAssigner && teamsData.length > 0) {
          setSelectedTeam(teamsData[0]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [onboardingApi, isAssigner]);

  // Fetch team stats when selectedTeam changes (lead roster mode)
  useEffect(() => {
    if (!selectedTeam) {
      setStats(undefined);
      return;
    }

    let cancelled = false;

    async function fetchStats() {
      try {
        setLoading(true);
        setError(undefined);
        const result = await onboardingApi.getTeamStats(selectedTeam);
        if (!cancelled) {
          setStats(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStats(undefined);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [onboardingApi, selectedTeam]);

  // Debounced buddy search
  useEffect(() => {
    if (!assigningBuddyFor) {
      setBuddyOptions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setBuddySearchLoading(true);
      try {
        const users = await onboardingApi.searchCatalogUsers(buddyInputValue);
        setBuddyOptions(users);
      } catch (e) {
        setBuddyOptions([]);
      } finally {
        setBuddySearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [onboardingApi, assigningBuddyFor, buddyInputValue]);

  const handleRowExpand = (userId: string) => {
    setExpandedRow(expandedRow === userId ? undefined : userId);
  };

  const handleAssignBuddyClick = (joiner: TeamJoinerSummary) => {
    setAssigningBuddyFor(joiner);
    setBuddyInputValue('');
    setBuddyOptions([]);
    setSelectedBuddy(null);
    setAssignError(undefined);
  };

  const handleAssignBuddyConfirm = async () => {
    if (!assigningBuddyFor || !selectedBuddy) return;

    setAssigningBuddy(true);
    setAssignError(undefined);

    try {
      await onboardingApi.setBuddy(
        assigningBuddyFor.userId,
        selectedBuddy.entityRef,
      );
      // Refresh team stats to show updated buddy assignment
      if (selectedTeam) {
        const result = await onboardingApi.getTeamStats(selectedTeam);
        setStats(result);
      }
      setAssigningBuddyFor(undefined);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigningBuddy(false);
    }
  };

  const handleDialogClose = () => {
    if (!assigningBuddy) {
      setAssigningBuddyFor(undefined);
      setBuddyInputValue('');
      setBuddyOptions([]);
      setSelectedBuddy(null);
      setAssignError(undefined);
    }
  };

  // Determine which mode to render
  const isLeadRosterMode = isAssigner && teams.length > 0;
  const isBuddyMode = !isLeadRosterMode;

  if (loading && !stats) {
    return (
      <Box>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text variant="body-small" className={styles.errorText}>
          {error}
        </Text>
      </Box>
    );
  }

  // Buddy/read-only mode
  if (isBuddyMode) {
    if (myBuddies.length === 0) {
      return (
        <Box>
          <Text variant="body-small" className={styles.helpText}>
            You are not currently assigned as a buddy for any joiner.
          </Text>
        </Box>
      );
    }

    return (
      <Box>
        <Text variant="title-medium" className={styles.sectionTitle}>
          My Buddies
        </Text>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {myBuddies.map(joiner => (
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
                    <TableCell>{daysSince(joiner.startDate)} days</TableCell>
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
                              {joiner.blockedTaskCount} task(s) are currently
                              blocked. View their individual checklist for
                              details.
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
      </Box>
    );
  }

  // Lead roster mode
  return (
    <Box>
      {teams.length > 1 && (
        <TextField
          className={styles.teamSelector}
          label="Team"
          variant="outlined"
          size="small"
          select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          fullWidth
        >
          {teams.map(team => (
            <MenuItem key={team} value={team}>
              {team}
            </MenuItem>
          ))}
        </TextField>
      )}

      {teams.length === 1 && (
        <Text variant="title-medium" className={styles.sectionTitle}>
          Team: {selectedTeam}
        </Text>
      )}

      {loading && <LinearProgress />}

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
                    <TableCell>Buddy</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.activeJoiners.map(joiner => (
                    <Fragment key={joiner.userId}>
                      <TableRow hover>
                        <TableCell
                          padding="checkbox"
                          onClick={() => handleRowExpand(joiner.userId)}
                          style={{ cursor: 'pointer' }}
                        >
                          <ButtonIcon size="small" variant="tertiary">
                            {expandedRow === joiner.userId ? (
                              <RiArrowUpSLine size={18} />
                            ) : (
                              <RiArrowDownSLine size={18} />
                            )}
                          </ButtonIcon>
                        </TableCell>
                        <TableCell
                          onClick={() => handleRowExpand(joiner.userId)}
                          style={{ cursor: 'pointer' }}
                        >
                          {joiner.displayName}
                        </TableCell>
                        <TableCell
                          onClick={() => handleRowExpand(joiner.userId)}
                          style={{ cursor: 'pointer' }}
                        >
                          {joiner.role}
                        </TableCell>
                        <TableCell
                          onClick={() => handleRowExpand(joiner.userId)}
                          style={{ cursor: 'pointer' }}
                        >
                          {daysSince(joiner.startDate)} days
                        </TableCell>
                        <TableCell
                          onClick={() => handleRowExpand(joiner.userId)}
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
                          onClick={() => handleRowExpand(joiner.userId)}
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
                        <TableCell>{joiner.buddyDisplayName ?? '—'}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            color="primary"
                            onClick={() => handleAssignBuddyClick(joiner)}
                          >
                            Assign Buddy
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell
                          colSpan={8}
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

      {/* Buddy assignment dialog */}
      <Dialog
        open={!!assigningBuddyFor}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Buddy</DialogTitle>
        <DialogContent>
          {assigningBuddyFor && (
            <Text variant="body-small">
              Assign a buddy for{' '}
              <strong>{assigningBuddyFor.displayName}</strong>.
            </Text>
          )}

          <Box mt="3">
            <Autocomplete
              options={buddyOptions}
              loading={buddySearchLoading}
              getOptionLabel={opt =>
                opt.email
                  ? `${opt.displayName} (${opt.email})`
                  : opt.displayName
              }
              inputValue={buddyInputValue}
              onInputChange={(_, val) => {
                setBuddyInputValue(val);
                if (!val.trim()) {
                  setSelectedBuddy(null);
                }
              }}
              onChange={(_, selected) => {
                setSelectedBuddy(selected);
              }}
              disabled={assigningBuddy}
              noOptionsText={
                buddySearchLoading ? 'Searching…' : 'No users found'
              }
              renderInput={params => (
                <TextField
                  {...params}
                  margin="dense"
                  label="Buddy"
                  variant="outlined"
                  fullWidth
                  placeholder="Search for a buddy"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {buddySearchLoading && <CircularProgress size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>

          {assignError && (
            <Text variant="body-small" className={styles.errorText}>
              {assignError}
            </Text>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={assigningBuddy}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignBuddyConfirm}
            color="primary"
            variant="contained"
            disabled={assigningBuddy || !selectedBuddy}
          >
            {assigningBuddy ? 'Assigning...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
