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

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { TeamView } from './TeamView';
import { OnboardingApi } from '../../api/OnboardingApi';
import { TeamOnboardingStats, TeamJoinerSummary } from '../../types';

const stats: TeamOnboardingStats = {
  teamName: 'platform',
  activeJoiners: [
    {
      userId: 'user:default/jane.doe',
      displayName: 'Jane Doe',
      role: 'backend-engineer',
      startDate: new Date().toISOString(),
      completionPercent: 60,
      blockedTaskCount: 2,
    },
  ],
  avgCompletionPercent: 60,
  totalBlockedTasks: 2,
};

const buddySummary: TeamJoinerSummary = {
  userId: 'user:default/john.smith',
  displayName: 'John Smith',
  role: 'frontend-engineer',
  startDate: new Date().toISOString(),
  completionPercent: 40,
  blockedTaskCount: 1,
};

function createOnboardingApiMock(): jest.Mocked<OnboardingApi> {
  return {
    getProgress: jest.fn(),
    updateTaskStatus: jest.fn(),
    getTeamStats: jest.fn(),
    getTemplates: jest.fn(),
    assignTemplate: jest.fn(),
    searchCatalogUsers: jest.fn(),
    setBuddy: jest.fn(),
    getMyTeams: jest.fn(),
    getMyBuddies: jest.fn(),
    getIsAssigner: jest.fn(),
  };
}

describe('TeamView', () => {
  describe('lead roster mode', () => {
    it('shows team stats for a lead with exactly one team', async () => {
      const onboardingApi = createOnboardingApiMock();
      onboardingApi.getMyTeams.mockResolvedValue({ teams: ['platform'] });
      onboardingApi.getMyBuddies.mockResolvedValue([]);
      onboardingApi.getTeamStats.mockResolvedValue(stats);

      render(<TeamView onboardingApi={onboardingApi} isAssigner />);

      // Should fetch stats for the single available team.
      await waitFor(() => {
        expect(onboardingApi.getTeamStats).toHaveBeenCalledWith('platform');
      });

      // Should show stats
      expect(await screen.findByText('Active Joiners')).toBeInTheDocument();
      expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('backend-engineer')).toBeInTheDocument();

      // Should show Assign Buddy button in roster mode
      expect(
        screen.getByRole('button', { name: /assign buddy/i }),
      ).toBeInTheDocument();
    });

    it('shows team selector for a lead with multiple teams', async () => {
      const onboardingApi = createOnboardingApiMock();
      onboardingApi.getMyTeams.mockResolvedValue({
        teams: ['platform', 'frontend'],
      });
      onboardingApi.getMyBuddies.mockResolvedValue([]);
      onboardingApi.getTeamStats.mockResolvedValue(stats);

      render(<TeamView onboardingApi={onboardingApi} isAssigner />);

      // Should default to first team and fetch its stats
      await waitFor(() => {
        expect(onboardingApi.getTeamStats).toHaveBeenCalledWith('platform');
      });
      expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    });

    it('allows assigning a buddy via the dialog', async () => {
      const onboardingApi = createOnboardingApiMock();
      onboardingApi.getMyTeams.mockResolvedValue({ teams: ['platform'] });
      onboardingApi.getMyBuddies.mockResolvedValue([]);
      onboardingApi.getTeamStats.mockResolvedValue(stats);
      onboardingApi.searchCatalogUsers.mockResolvedValue([
        {
          entityRef: 'user:default/buddy.user',
          displayName: 'Buddy User',
          email: 'buddy@example.com',
        },
      ]);
      onboardingApi.setBuddy.mockResolvedValue();

      render(<TeamView onboardingApi={onboardingApi} isAssigner />);

      // Click Assign Buddy button
      const assignButton = await screen.findByRole('button', {
        name: /assign buddy/i,
      });
      await userEvent.click(assignButton);

      // Dialog should open (scoped to dialog to avoid ambiguity with button)
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/assign buddy/i)).toBeInTheDocument();

      // Search for buddy
      const buddySearchField = screen.getByLabelText(/buddy/i);
      await userEvent.type(buddySearchField, 'Buddy');

      // Wait for search to complete
      await waitFor(() => {
        expect(onboardingApi.searchCatalogUsers).toHaveBeenCalledWith('Buddy');
      });

      // Select buddy option from autocomplete dropdown
      const buddyOption = await screen.findByText(
        'Buddy User (buddy@example.com)',
      );
      await userEvent.click(buddyOption);

      // Confirm assignment
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(onboardingApi.setBuddy).toHaveBeenCalledWith(
          'user:default/jane.doe',
          'user:default/buddy.user',
        );
      });
    });
  });

  describe('buddy read-only mode', () => {
    it('shows My Buddies view when not an assigner', async () => {
      const onboardingApi = createOnboardingApiMock();
      onboardingApi.getMyTeams.mockResolvedValue({ teams: [] });
      onboardingApi.getMyBuddies.mockResolvedValue([buddySummary]);

      render(<TeamView onboardingApi={onboardingApi} isAssigner={false} />);

      // Should show My Buddies header
      expect(await screen.findByText('My Buddies')).toBeInTheDocument();

      // Should show buddy info
      expect(await screen.findByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('frontend-engineer')).toBeInTheDocument();

      // Should NOT show Assign Buddy button in buddy mode
      expect(
        screen.queryByRole('button', { name: /assign buddy/i }),
      ).not.toBeInTheDocument();
    });

    it('shows empty state when not assigned as a buddy', async () => {
      const onboardingApi = createOnboardingApiMock();
      onboardingApi.getMyTeams.mockResolvedValue({ teams: [] });
      onboardingApi.getMyBuddies.mockResolvedValue([]);

      render(<TeamView onboardingApi={onboardingApi} isAssigner={false} />);

      expect(
        await screen.findByText(
          /you are not currently assigned as a buddy for any joiner/i,
        ),
      ).toBeInTheDocument();
    });

    it('shows buddy mode when assigner has zero teams', async () => {
      const onboardingApi = createOnboardingApiMock();
      onboardingApi.getMyTeams.mockResolvedValue({ teams: [] });
      onboardingApi.getMyBuddies.mockResolvedValue([buddySummary]);

      render(<TeamView onboardingApi={onboardingApi} isAssigner />);

      // Even though isAssigner=true, zero teams → buddy mode
      expect(await screen.findByText('My Buddies')).toBeInTheDocument();
      expect(await screen.findByText('John Smith')).toBeInTheDocument();

      // No Assign Buddy button in buddy mode
      expect(
        screen.queryByRole('button', { name: /assign buddy/i }),
      ).not.toBeInTheDocument();
    });
  });
});
