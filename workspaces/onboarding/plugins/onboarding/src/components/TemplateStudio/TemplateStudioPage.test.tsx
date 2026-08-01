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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiProvider } from '@backstage/core-app-api';
import { TestApiRegistry } from '@backstage/test-utils';
import { onboardingApiRef, OnboardingApi } from '../../api/OnboardingApi';
import { TemplateStudioPage } from './TemplateStudioPage';
import { OnboardingTemplate, TemplateBlock, TemplateDraft } from '../../types';

// The TechDocs markdown editor lazy-loads Toast UI which is unnecessary here.
jest.mock('@estehsaan/backstage-plugin-techdocs-editor-react', () => ({
  TechDocsMarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

const template: OnboardingTemplate = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: { name: 'eng', title: 'Engineer', description: '' },
  spec: {
    role: 'engineer',
    phases: [
      {
        id: 'day1',
        tasks: [
          {
            id: 'setup',
            phase: 'day1',
            title: 'Set up laptop',
            description: 'Configure your machine.',
            type: 'manual',
            assignee: 'self',
            duePhase: 'day1',
          },
        ],
      },
    ],
  },
};

const draft: TemplateDraft = {
  name: 'eng',
  template,
  sourceLocation: 'url:https://github.com/o/r/blob/main/eng.yaml',
  updatedAt: '2026-08-01T00:00:00.000Z',
  status: 'draft',
};

const blocks: TemplateBlock[] = [
  {
    id: 'builtin:task-buddy',
    kind: 'task',
    title: 'Meet your buddy',
    task: {
      phase: 'day1',
      title: 'Meet your buddy',
      description: 'Say hello.',
      type: 'manual',
      assignee: 'buddy',
      duePhase: 'day1',
    },
  },
];

function makeApi(): jest.Mocked<OnboardingApi> {
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
    getTemplateDraft: jest.fn().mockResolvedValue(draft),
    saveTemplateDraft: jest.fn().mockResolvedValue(draft),
    createTemplateDraft: jest.fn().mockResolvedValue(draft),
    listBlocks: jest.fn().mockResolvedValue(blocks),
    validateTemplate: jest.fn().mockResolvedValue([]),
    publishTemplate: jest
      .fn()
      .mockResolvedValue({ url: 'http://pr/1', number: 1 }),
  } as unknown as jest.Mocked<OnboardingApi>;
}

function renderStudio(api: OnboardingApi, name = 'eng') {
  const apis = TestApiRegistry.from([onboardingApiRef, api]);
  return render(
    <ApiProvider apis={apis}>
      <TemplateStudioPage templateName={name} />
    </ApiProvider>,
  );
}

describe('TemplateStudioPage', () => {
  it('loads a draft and renders its task', async () => {
    renderStudio(makeApi());

    expect(
      await screen.findByText('Template Studio — Engineer'),
    ).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue('Set up laptop'),
    ).toBeInTheDocument();
  });

  it('inserts a block task from the library and validates the result', async () => {
    const api = makeApi();
    renderStudio(api);

    const addButton = await screen.findByRole('button', { name: 'Add block' });
    await userEvent.click(addButton);

    expect(
      await screen.findByDisplayValue('Meet your buddy'),
    ).toBeInTheDocument();
    expect(api.validateTemplate).toHaveBeenCalled();
  });

  it('shows a create form for the new-template flow', async () => {
    const api = makeApi();
    renderStudio(api, 'new');

    expect(
      await screen.findByText('New onboarding template'),
    ).toBeInTheDocument();
    expect(api.getTemplateDraft).not.toHaveBeenCalled();
  });
});
