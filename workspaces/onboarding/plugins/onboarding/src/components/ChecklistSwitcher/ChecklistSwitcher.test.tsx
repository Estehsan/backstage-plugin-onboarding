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

import { fireEvent, render, screen } from '@testing-library/react';
import { OnboardingProgress, OnboardingTemplate } from '../../types';
import { ChecklistSwitcher } from './ChecklistSwitcher';

function makeTemplate(name: string, title: string): OnboardingTemplate {
  return {
    apiVersion: 'onboarding.backstage.io/v1',
    kind: 'OnboardingTemplate',
    metadata: { name, title },
    spec: { role: name, phases: [] },
  } as unknown as OnboardingTemplate;
}

function makeProgress(
  templateName: string,
  done: number,
  total: number,
): OnboardingProgress {
  return {
    userId: 'user:default/jane',
    templateName,
    startDate: '2026-01-01',
    tasks: [
      ...Array.from({ length: done }, (_, i) => ({
        taskId: `${templateName}-done-${i}`,
        status: 'done' as const,
      })),
      ...Array.from({ length: total - done }, (_, i) => ({
        taskId: `${templateName}-pending-${i}`,
        status: 'pending' as const,
      })),
    ],
  };
}

describe('ChecklistSwitcher', () => {
  it('renders one card per assigned template with its own independent progress', async () => {
    const templates = [
      makeTemplate('backend-engineer', 'Backend Engineer'),
      makeTemplate('new-manager', 'New Manager'),
    ];
    const progressList = [
      makeProgress('backend-engineer', 1, 4),
      makeProgress('new-manager', 3, 3),
    ];
    const onSelect = jest.fn();

    render(
      <ChecklistSwitcher
        progressList={progressList}
        templates={templates}
        selectedTemplateName="backend-engineer"
        onSelect={onSelect}
      />,
    );

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('New Manager')).toBeInTheDocument();
    // Each template keeps its own distinct completion figures, not a merged total.
    expect(screen.getByText('1 of 4 tasks complete')).toBeInTheDocument();
    expect(screen.getByText('3 of 3 tasks complete')).toBeInTheDocument();
  });

  it('calls onSelect with the template name when a card is pressed', async () => {
    const templates = [makeTemplate('new-manager', 'New Manager')];
    const progressList = [makeProgress('new-manager', 0, 2)];
    const onSelect = jest.fn();

    render(
      <ChecklistSwitcher
        progressList={progressList}
        templates={templates}
        selectedTemplateName="backend-engineer"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(await screen.findByText('New Manager'));

    expect(onSelect).toHaveBeenCalledWith('new-manager');
  });
});
