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
import { renderInTestApp } from '@backstage/test-utils';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders the completed/total label and the rounded percentage', async () => {
    await renderInTestApp(<ProgressBar completed={1} total={4} />);

    expect(
      await screen.findByText('1 of 4 tasks complete'),
    ).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders 0% without dividing by zero when there are no tasks', async () => {
    await renderInTestApp(<ProgressBar completed={0} total={0} />);

    expect(
      await screen.findByText('0 of 0 tasks complete'),
    ).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
