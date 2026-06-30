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

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { TeamView } from './TeamView';
import { OnboardingApi } from '../../api/OnboardingApi';
import { TeamOnboardingStats } from '../../types';

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

function createOnboardingApiMock(): jest.Mocked<OnboardingApi> {
  return {
    getProgress: jest.fn(),
    updateTaskStatus: jest.fn(),
    getTeamStats: jest.fn(),
    getTemplates: jest.fn(),
    assignTemplate: jest.fn(),
    searchCatalogUsers: jest.fn(),
  };
}

describe('TeamView', () => {
  it('shows the prompt before a team is searched', async () => {
    const onboardingApi = createOnboardingApiMock();

    await renderInTestApp(<TeamView onboardingApi={onboardingApi} />);

    expect(
      await screen.findByText('Enter a team name to view onboarding stats.'),
    ).toBeInTheDocument();
  });

  it('searches the team and renders the returned stats', async () => {
    const onboardingApi = createOnboardingApiMock();
    onboardingApi.getTeamStats.mockResolvedValue(stats);

    await renderInTestApp(<TeamView onboardingApi={onboardingApi} />);

    await userEvent.type(
      await screen.findByPlaceholderText('e.g. platform'),
      'platform',
    );

    expect(await screen.findByText('Active Joiners')).toBeInTheDocument();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('backend-engineer')).toBeInTheDocument();
    expect(onboardingApi.getTeamStats).toHaveBeenCalledWith('platform');
  });
});
