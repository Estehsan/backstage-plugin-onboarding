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

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { PublishDialog } from './PublishDialog';

const openDialog = async () => {
  await act(async () => {
    await userEvent.click(
      await screen.findByRole('button', { name: 'Publish…' }),
    );
  });
};

const submit = async () => {
  await act(async () => {
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open pull request' }),
    );
  });
};

describe('PublishDialog', () => {
  it('shows the provider error text in a danger alert and keeps the form open', async () => {
    const onPublish = jest
      .fn()
      .mockRejectedValue(
        new Error(
          'github failed to open a pull request for https://github.com/o/r: 403 Resource not accessible by integration',
        ),
      );

    await renderInTestApp(
      <PublishDialog hasSourceLocation onPublish={onPublish} />,
    );
    await openDialog();
    await submit();

    expect(
      await screen.findByText(
        /github failed to open a pull request for https:\/\/github\.com\/o\/r/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pull request opened/)).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();
  });

  it('lists validation issues attached to the publish error', async () => {
    const failure = Object.assign(
      new Error('Template has 2 validation error(s)'),
      {
        status: 400,
        issues: [
          {
            path: 'spec.phases',
            message: 'at least one phase is required',
            severity: 'error' as const,
          },
          {
            path: 'spec.role',
            message: 'role is required',
            severity: 'error' as const,
          },
        ],
      },
    );
    const onPublish = jest.fn().mockRejectedValue(failure);

    await renderInTestApp(
      <PublishDialog hasSourceLocation onPublish={onPublish} />,
    );
    await openDialog();
    await submit();

    expect(
      await screen.findByText(/at least one phase is required/),
    ).toBeInTheDocument();
    expect(await screen.findByText(/role is required/)).toBeInTheDocument();
    expect(await screen.findByText('spec.phases')).toBeInTheDocument();
  });

  it('renders the PR link, branch and target on success', async () => {
    const onPublish = jest.fn().mockResolvedValue({
      url: 'https://github.com/o/r/pull/42',
      number: 42,
      headBranch: 'onboarding/template-eng/jane/1700000000-ab12',
      repoUrl: 'https://github.com/o/r',
      filePath: 'catalog/onboarding/eng.yaml',
      providerId: 'github',
    });

    await renderInTestApp(
      <PublishDialog hasSourceLocation onPublish={onPublish} />,
    );
    await openDialog();
    await submit();

    const link = await screen.findByRole('link', { name: '#42' });
    expect(link).toHaveAttribute('href', 'https://github.com/o/r/pull/42');
    expect(
      await screen.findByText(
        /onboarding\/template-eng\/jane\/1700000000-ab12/,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/catalog\/onboarding\/eng\.yaml/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/https:\/\/github\.com\/o\/r/),
    ).toBeInTheDocument();
  });

  it('does not render success when the response has no url', async () => {
    const onPublish = jest.fn().mockResolvedValue({ number: 0 } as any);

    await renderInTestApp(
      <PublishDialog hasSourceLocation onPublish={onPublish} />,
    );
    await openDialog();
    await submit();

    expect(await screen.findByText(/no pull request URL/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pull request opened/)).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();
  });
});
