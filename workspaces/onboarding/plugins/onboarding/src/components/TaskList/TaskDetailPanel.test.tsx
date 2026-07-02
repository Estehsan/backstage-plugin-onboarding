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

import { screen, render } from '@testing-library/react';
import { TaskDetailPanel } from './TaskDetailPanel';
import { OnboardingTask } from '../../types';

const taskWithResources: OnboardingTask = {
  id: 'resource-task',
  phase: 'day1',
  title: 'Task With Resources',
  description: 'Has learning resources attached',
  type: 'manual',
  assignee: 'self',
  duePhase: 'day1',
  resources: [
    {
      type: 'video',
      title: 'Intro video',
      url: 'https://example.com/video',
      duration: '10 min',
    },
    {
      type: 'doc',
      title: 'Reference doc',
      url: 'https://example.com/doc',
    },
  ],
};

describe('TaskDetailPanel', () => {
  it('renders resource tags without throwing when expanded', () => {
    // Regression test: @backstage/ui's `Tag` is a react-aria-components
    // collection item and must be rendered inside a `TagGroup`/`TagList`,
    // otherwise it throws "cannot be rendered outside a collection".
    expect(() =>
      render(<TaskDetailPanel task={taskWithResources} open />),
    ).not.toThrow();

    expect(screen.getByText('Intro video')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('10 min')).toBeInTheDocument();
    expect(screen.getByText('Reference doc')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
  });
});
