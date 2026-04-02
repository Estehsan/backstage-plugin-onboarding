/// <reference types="jest" />

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
import { TemplatesView } from './TemplatesView';
import { OnboardingApi } from '../../api/OnboardingApi';
import { OnboardingTemplate } from '../../types';

const template: OnboardingTemplate = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: {
    name: 'backend-template',
    title: 'Backend Template',
    description: 'Backend onboarding template',
  },
  spec: {
    role: 'backend-engineer',
    team: 'platform',
    phases: [
      {
        id: 'day1',
        tasks: [
          {
            id: 'setup-env',
            phase: 'day1',
            title: 'Set up environment',
            description: 'Set up your local environment.',
            type: 'manual',
            assignee: 'self',
            duePhase: 'day1',
          },
        ],
      },
    ],
  },
};

const progress = {
  userId: 'user:default/jane.doe',
  templateName: 'backend-template',
  startDate: new Date().toISOString(),
  tasks: [{ taskId: 'setup-env', status: 'pending' as const }],
};

function createOnboardingApiMock(): jest.Mocked<OnboardingApi> {
  return {
    getProgress: jest.fn<
      ReturnType<OnboardingApi['getProgress']>,
      Parameters<OnboardingApi['getProgress']>
    >(),
    updateTaskStatus: jest.fn<
      ReturnType<OnboardingApi['updateTaskStatus']>,
      Parameters<OnboardingApi['updateTaskStatus']>
    >(),
    getTeamStats: jest.fn<
      ReturnType<OnboardingApi['getTeamStats']>,
      Parameters<OnboardingApi['getTeamStats']>
    >(),
    getTemplates: jest.fn<
      ReturnType<OnboardingApi['getTemplates']>,
      Parameters<OnboardingApi['getTemplates']>
    >(),
    assignTemplate: jest
      .fn<
        ReturnType<OnboardingApi['assignTemplate']>,
        Parameters<OnboardingApi['assignTemplate']>
      >()
      .mockResolvedValue(progress),
    searchCatalogUsers: jest
      .fn<
        ReturnType<OnboardingApi['searchCatalogUsers']>,
        Parameters<OnboardingApi['searchCatalogUsers']>
      >()
      .mockResolvedValue([]),
  };
}

describe('TemplatesView', () => {
  it('assigns template using searched catalog user', async () => {
    const onboardingApi = createOnboardingApiMock();
    onboardingApi.searchCatalogUsers.mockResolvedValue([
      {
        entityRef: 'user:default/jane.doe',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
      },
    ]);

    await renderInTestApp(
      <TemplatesView templates={[template]} onboardingApi={onboardingApi} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Use Template' }));

    const searchInput = await screen.findByLabelText('Search User');
    await userEvent.type(searchInput, 'jane');

    await userEvent.click(
      await screen.findByText('Jane Doe (jane@example.com)'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await screen.findByText('Template assigned successfully!');
    expect(onboardingApi.assignTemplate).toHaveBeenCalledWith(
      'backend-template',
      'user:default/jane.doe',
    );
  });

  it('allows manual user entity ref fallback', async () => {
    const onboardingApi = createOnboardingApiMock();

    await renderInTestApp(
      <TemplatesView templates={[template]} onboardingApi={onboardingApi} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Use Template' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enter entity ref manually' }),
    );

    await userEvent.type(
      await screen.findByLabelText('User Entity Ref'),
      'user:default/alex',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await screen.findByText('Template assigned successfully!');
    expect(onboardingApi.assignTemplate).toHaveBeenCalledWith(
      'backend-template',
      'user:default/alex',
    );
  });
});
