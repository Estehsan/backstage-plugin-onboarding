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

import { useEffect, useState } from 'react';
import { Box, Text } from '@backstage/ui';
import LinearProgress from '@material-ui/core/LinearProgress';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { InfoCard } from '@backstage/core-components';
import { OnboardingApi } from '../../api/OnboardingApi';
import { TeamOnboardingStats, TeamJoinerSummary } from '../../types';
import { JoinerTable } from './JoinerTable';
import { AssignBuddyDialog } from './AssignBuddyDialog';
import styles from './TeamView.module.css';

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
  const [statsError, setStatsError] = useState<string | undefined>();

  // Buddy assignment dialog state
  const [assigningBuddyFor, setAssigningBuddyFor] = useState<
    TeamJoinerSummary | undefined
  >();

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
        } else {
          // eslint-disable-next-line no-console
          console.error(
            'Failed to load my teams, defaulting to none:',
            teamsResult.reason,
          );
        }

        if (buddiesResult.status === 'fulfilled') {
          buddiesData = buddiesResult.value;
        } else {
          // eslint-disable-next-line no-console
          console.error(
            'Failed to load my buddies, defaulting to none:',
            buddiesResult.reason,
          );
        }

        setTeams(teamsData);
        setMyBuddies(buddiesData);

        // If in assigner mode with teams, default to first team
        if (isAssigner && teamsData.length > 0) {
          setSelectedTeam(teamsData[0]);
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
      setStatsError(undefined);
      return undefined;
    }

    let cancelled = false;

    async function fetchStats() {
      try {
        setLoading(true);
        setStatsError(undefined);
        const result = await onboardingApi.getTeamStats(selectedTeam);
        if (!cancelled) {
          setStats(result);
        }
      } catch (e) {
        if (!cancelled) {
          setStatsError(e instanceof Error ? e.message : String(e));
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

  const handleAssignBuddyClick = (joiner: TeamJoinerSummary) => {
    setAssigningBuddyFor(joiner);
  };

  const handleBuddyAssigned = async () => {
    // Refresh team stats to show updated buddy assignment
    if (selectedTeam) {
      try {
        const result = await onboardingApi.getTeamStats(selectedTeam);
        setStats(result);
      } catch (e) {
        // Silently ignore refresh errors; user can manually refresh
      }
    }
  };

  const handleDialogClose = () => {
    setAssigningBuddyFor(undefined);
  };

  // Determine which mode to render
  const isLeadRosterMode = isAssigner && teams.length > 0;
  const isBuddyMode = !isLeadRosterMode;

  if (loading && !stats && myBuddies.length === 0) {
    return (
      <Box>
        <LinearProgress />
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
        <JoinerTable joiners={myBuddies} showBuddyColumn={false} />
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

      {statsError && (
        <Text variant="body-small" className={styles.errorText}>
          {statsError}
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
            <JoinerTable
              joiners={stats.activeJoiners}
              showBuddyColumn
              onAssignBuddy={handleAssignBuddyClick}
            />
          ) : (
            <Text variant="body-small" className={styles.helpText}>
              No active joiners found for team &quot;{stats.teamName}&quot;.
            </Text>
          )}
        </>
      )}

      {/* Buddy assignment dialog */}
      <AssignBuddyDialog
        joiner={assigningBuddyFor}
        onboardingApi={onboardingApi}
        onClose={handleDialogClose}
        onAssigned={handleBuddyAssigned}
      />
    </Box>
  );
}
