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
import { render } from '@testing-library/react';
import { TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { identityApiRef } from '@backstage/core-plugin-api';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { onboardingApiRef, OnboardingApi } from '../../api/OnboardingApi';
import { OnboardingPage } from './OnboardingPage';
import {
  OnboardingProgress,
  OnboardingTemplate,
  TeamJoinerSummary,
} from '../../types';

jest.mock('@backstage/core-components', () => {
  const actual = jest.requireActual('@backstage/core-components');
  return {
    ...actual,
    Page: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Header: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
      <header>
        {title ? <h1>{title}</h1> : null}
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
    ),
    Content: ({ children }: { children: React.ReactNode }) => (
      <main>{children}</main>
    ),
  };
});

const mockTemplate: OnboardingTemplate = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: {
    name: 'backend-engineer-platform',
    title: 'Backend Engineer — Platform Team',
    description: 'Standard onboarding for backend engineers',
  },
  spec: {
    role: 'backend-engineer',
    team: 'platform',
    phases: [
      {
        id: 'day1',
        tasks: [
          {
            id: 'setup-laptop',
            phase: 'day1',
            title: 'Set up laptop & dev environment',
            description: 'Run the bootstrap script.',
            type: 'automated',
            automationRef: 'setup-dev-environment',
            assignee: 'self',
            duePhase: 'day1',
          },
          {
            id: 'meet-buddy',
            phase: 'day1',
            title: 'Meet your onboarding buddy',
            description: '30-min intro call.',
            type: 'manual',
            assignee: 'buddy',
            duePhase: 'day1',
          },
        ],
      },
      {
        id: 'week1',
        tasks: [
          {
            id: 'security-training',
            phase: 'week1',
            title: 'Complete security training',
            description: 'Required before production access.',
            type: 'manual',
            assignee: 'self',
            duePhase: 'week1',
          },
          {
            id: 'oncall-shadow',
            phase: 'week1',
            title: 'Shadow an on-call shift',
            description: 'Join the current on-call engineer.',
            type: 'manual',
            assignee: 'buddy',
            dependsOn: ['security-training'],
            duePhase: 'week1',
          },
        ],
      },
    ],
  },
};

const mockProgress: OnboardingProgress = {
  userId: 'user:default/testuser',
  templateName: 'backend-engineer-platform',
  startDate: new Date().toISOString(),
  tasks: [
    { taskId: 'setup-laptop', status: 'pending' },
    {
      taskId: 'meet-buddy',
      status: 'done',
      completedAt: new Date().toISOString(),
    },
    { taskId: 'security-training', status: 'pending' },
    { taskId: 'oncall-shadow', status: 'pending' },
  ],
};

// Spec 001 FR-002/FR-005: a second concurrently-assigned template used to
// exercise the multiple-template selector.
const mockTemplate2: OnboardingTemplate = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: {
    name: 'security-champion',
    title: 'Security Champion',
    description: 'Cross-team security onboarding',
  },
  spec: {
    role: 'security-champion',
    team: 'platform',
    phases: [
      {
        id: 'week1',
        tasks: [
          {
            id: 'threat-model-101',
            phase: 'week1',
            title: 'Complete threat modeling 101',
            description: 'Intro to threat modeling.',
            type: 'manual',
            assignee: 'self',
            duePhase: 'week1',
          },
        ],
      },
    ],
  },
};

const mockProgress2: OnboardingProgress = {
  userId: 'user:default/testuser',
  templateName: 'security-champion',
  startDate: new Date().toISOString(),
  tasks: [{ taskId: 'threat-model-101', status: 'pending' }],
};

const mockOnboardingApi: jest.Mocked<OnboardingApi> = {
  getProgressList: jest.fn(),
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

const mockIdentityApi = {
  getBackstageIdentity: jest.fn().mockResolvedValue({
    type: 'user',
    userEntityRef: 'user:default/testuser',
    ownershipEntityRefs: [],
  }),
  getCredentials: jest.fn().mockResolvedValue({}),
  getProfileInfo: jest.fn().mockResolvedValue({
    displayName: 'Test User',
    email: 'test@example.com',
  }),
  signOut: jest.fn(),
};

const mockScaffolderApi = {
  scaffold: jest.fn(),
  getTask: jest.fn(),
  getIntegrationsList: jest.fn(),
  getTemplateParameterSchema: jest.fn(),
  streamLogs: jest.fn(),
  listActions: jest.fn(),
  listTasks: jest.fn(),
  cancelTask: jest.fn(),
};

const apis = TestApiRegistry.from(
  [onboardingApiRef, mockOnboardingApi],
  [identityApiRef, mockIdentityApi],
  [scaffolderApiRef, mockScaffolderApi],
);

describe('OnboardingPage', () => {
  const renderPage = () =>
    render(
      <ApiProvider apis={apis}>
        <OnboardingPage />
      </ApiProvider>,
    );

  beforeEach(() => {
    jest.resetAllMocks();
    mockIdentityApi.getBackstageIdentity.mockResolvedValue({
      type: 'user',
      userEntityRef: 'user:default/testuser',
      ownershipEntityRefs: [],
    });
    mockOnboardingApi.getProgressList.mockResolvedValue([mockProgress]);
    mockOnboardingApi.getTemplates.mockResolvedValue([mockTemplate]);
    // Default to assigner state to keep existing tests passing
    mockOnboardingApi.getIsAssigner.mockResolvedValue({ isAssigner: true });
    mockOnboardingApi.getMyBuddies.mockResolvedValue([]);
  });

  it('renders the page with tabs and task list', async () => {
    renderPage();

    expect(await screen.findByText('Developer Onboarding')).toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.getByText('Team View')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();

    expect(
      await screen.findByText('1 of 4 tasks complete'),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Day 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Week 1').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Set up laptop & dev environment'),
    ).toBeInTheDocument();
    expect(screen.getByText('Meet your onboarding buddy')).toBeInTheDocument();
    expect(screen.getByText('Complete security training')).toBeInTheDocument();
    expect(screen.getByText('Shadow an on-call shift')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', async () => {
    renderPage();

    expect(await screen.findByText('25%')).toBeInTheDocument();
    expect(screen.getByText('1 of 4 tasks complete')).toBeInTheDocument();
  });

  it('calls updateTaskStatus when a task checkbox is toggled', async () => {
    const updatedProgress = {
      ...mockProgress,
      tasks: mockProgress.tasks.map(t =>
        t.taskId === 'security-training'
          ? {
              ...t,
              status: 'done' as const,
              completedAt: new Date().toISOString(),
            }
          : t,
      ),
    };
    mockOnboardingApi.updateTaskStatus.mockResolvedValue(updatedProgress);

    renderPage();

    await screen.findByText('Complete security training');

    const checkboxes = screen.getAllByRole('checkbox');
    const securityCheckbox = checkboxes.find(
      cb =>
        cb.getAttribute('aria-label') ===
        'Mark "Complete security training" as complete',
    );
    expect(securityCheckbox).toBeDefined();

    await userEvent.click(securityCheckbox!);

    expect(mockOnboardingApi.updateTaskStatus).toHaveBeenCalledWith(
      'user:default/testuser',
      'backend-engineer-platform',
      'security-training',
      'done',
    );
  });

  it('shows locked state for tasks with unmet dependencies', async () => {
    renderPage();

    await screen.findByText('Shadow an on-call shift');

    const oncallCheckbox = screen
      .getAllByRole('checkbox')
      .find(
        cb =>
          cb.getAttribute('aria-label') ===
          'Mark "Shadow an on-call shift" as complete',
      );
    expect(oncallCheckbox).toBeDisabled();
  });

  it('renders no checklist selector when only one template is assigned', async () => {
    // Spec 001 FR-005 / SC-003: a single assigned template renders with zero
    // extra chrome — the default beforeEach assigns exactly one template.
    renderPage();

    expect(
      await screen.findByText('Set up laptop & dev environment'),
    ).toBeInTheDocument();
    // The template title only ever appears as a selector option label, so its
    // absence proves no selector was rendered.
    expect(
      screen.queryByText('Backend Engineer — Platform Team'),
    ).not.toBeInTheDocument();
  });

  it('shows a checklist selector and swaps tasks when multiple templates are assigned', async () => {
    // Spec 001 FR-002/FR-005 (User Story P1): two concurrent templates.
    mockOnboardingApi.getProgressList.mockResolvedValue([
      mockProgress,
      mockProgress2,
    ]);
    mockOnboardingApi.getTemplates.mockResolvedValue([
      mockTemplate,
      mockTemplate2,
    ]);

    renderPage();

    // The first assigned template's checklist is shown by default.
    expect(
      await screen.findByText('Set up laptop & dev environment'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Complete threat modeling 101'),
    ).not.toBeInTheDocument();

    // Each assigned template renders as its own checklist card; clicking the
    // second one swaps the visible checklist without touching the first.
    const secondCard = screen.getByRole('button', {
      name: /Switch to Security Champion checklist/,
    });
    await userEvent.click(secondCard);

    expect(
      await screen.findByText('Complete threat modeling 101'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Set up laptop & dev environment'),
    ).not.toBeInTheDocument();
  });

  it('shows empty state when no progress exists', async () => {
    // Spec 001 FR-002: no assigned templates is now an empty array, not a 404.
    mockOnboardingApi.getProgressList.mockResolvedValue([]);
    mockOnboardingApi.getTemplates.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText(/No onboarding checklist assigned/),
    ).toBeInTheDocument();
  });

  it('hides the Templates tab for non-assigners without buddies', async () => {
    mockOnboardingApi.getIsAssigner.mockResolvedValue({ isAssigner: false });
    mockOnboardingApi.getMyBuddies.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Developer Onboarding')).toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.queryByText('Templates')).not.toBeInTheDocument();
    expect(screen.queryByText('Team View')).not.toBeInTheDocument();
  });

  it('shows the Templates tab for assigners', async () => {
    mockOnboardingApi.getIsAssigner.mockResolvedValue({ isAssigner: true });
    mockOnboardingApi.getMyBuddies.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Developer Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Team View')).toBeInTheDocument();
  });

  it('shows the Team View tab for a buddy with assigned joiners even if not an assigner', async () => {
    const mockBuddy: TeamJoinerSummary = {
      userId: 'user:default/newjoiner',
      displayName: 'New Joiner',
      role: 'backend-engineer',
      templateName: 'backend-engineer',
      startDate: '2026-07-01T00:00:00Z',
      completionPercent: 25,
      blockedTaskCount: 0,
    };

    mockOnboardingApi.getIsAssigner.mockResolvedValue({ isAssigner: false });
    mockOnboardingApi.getMyBuddies.mockResolvedValue([mockBuddy]);

    renderPage();

    expect(await screen.findByText('Developer Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Team View')).toBeInTheDocument();
    expect(screen.queryByText('Templates')).not.toBeInTheDocument();
  });

  it('hides the Team View tab for a non-assigner with no buddies', async () => {
    mockOnboardingApi.getIsAssigner.mockResolvedValue({ isAssigner: false });
    mockOnboardingApi.getMyBuddies.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Developer Onboarding')).toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.queryByText('Team View')).not.toBeInTheDocument();
  });
});
