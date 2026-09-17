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

import { ConfigReader } from '@backstage/config';
import { GithubOnboardingVcsProvider } from './GithubOnboardingVcsProvider';

const mockGetCredentials = jest.fn();
jest.mock('@backstage/integration', () => {
  const real = jest.requireActual('@backstage/integration');
  return {
    ...real,
    DefaultGithubCredentialsProvider: {
      fromIntegrations: () => ({ getCredentials: mockGetCredentials }),
    },
  };
});

const mockReposGet = jest.fn();
const mockGetRef = jest.fn();
const mockCreateRef = jest.fn();
const mockGetContent = jest.fn();
const mockCreateOrUpdateFileContents = jest.fn();
const mockPullsCreate = jest.fn();
const mockRequestReviewers = jest.fn();

jest.mock('octokit', () => ({
  Octokit: class MockOctokit {
    rest = {
      repos: {
        get: mockReposGet,
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
      git: { getRef: mockGetRef, createRef: mockCreateRef },
      pulls: {
        create: mockPullsCreate,
        requestReviewers: mockRequestReviewers,
      },
    };
  },
}));

const REPO_URL = 'https://github.com/o/r';

function buildProvider(
  config = new ConfigReader({
    integrations: { github: [{ host: 'github.com', token: 'fake-token' }] },
  }),
) {
  return new GithubOnboardingVcsProvider(config);
}

function openPrOptions(overrides: Record<string, unknown> = {}) {
  return {
    repoUrl: REPO_URL,
    headBranch: 'onboarding/template-eng/jane/1-ab',
    baseBranch: 'main',
    title: 'Update onboarding template',
    description: 'body text',
    files: new Map([['catalog/onboarding/eng.yaml', { content: 'kind: X\n' }]]),
    commitMessage: 'chore: update eng template',
    authorName: 'jane.doe',
    authorEmail: 'jane.doe@users.noreply.github.com',
    ...overrides,
  } as any;
}

describe('GithubOnboardingVcsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCredentials.mockResolvedValue({ token: 'fake-token', headers: {} });
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'base-sha' } } });
    mockCreateRef.mockResolvedValue({ data: {} });
    mockGetContent.mockRejectedValue(
      Object.assign(new Error('Not Found'), { status: 404 }),
    );
    mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });
    mockPullsCreate.mockResolvedValue({
      data: { html_url: 'https://github.com/o/r/pull/7', number: 7 },
    });
  });

  it('exposes the stable provider id "github"', () => {
    expect(buildProvider().id).toBe('github');
  });

  it('canHandle matches github.com and the configured enterprise host only', () => {
    const provider = buildProvider(
      new ConfigReader({
        integrations: {
          github: [
            {
              host: 'ghe.acme.com',
              token: 'fake-token',
              apiBaseUrl: 'https://ghe.acme.com/api/v3',
            },
          ],
        },
      }),
    );

    expect(provider.canHandle('https://github.com/o/r')).toBe(true);
    expect(provider.canHandle('https://ghe.acme.com/o/r')).toBe(true);
    expect(provider.canHandle('https://gitlab.com/o/r')).toBe(false);
    expect(provider.canHandle('not a url')).toBe(false);
  });

  it('reads the default branch through the GitHub API', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'trunk' } });
    await expect(buildProvider().getDefaultBranch(REPO_URL)).resolves.toBe(
      'trunk',
    );
    expect(mockReposGet).toHaveBeenCalledWith({ owner: 'o', repo: 'r' });
  });

  it('creates the branch, commits the file and opens the pull request', async () => {
    const result = await buildProvider().openPullRequest(
      openPrOptions({ draft: true, reviewers: ['reviewer-1'] }),
    );

    expect(mockCreateRef).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      ref: 'refs/heads/onboarding/template-eng/jane/1-ab',
      sha: 'base-sha',
    });
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'o',
        repo: 'r',
        path: 'catalog/onboarding/eng.yaml',
        branch: 'onboarding/template-eng/jane/1-ab',
        message: 'chore: update eng template',
        content: Buffer.from('kind: X\n', 'utf-8').toString('base64'),
        author: {
          name: 'jane.doe',
          email: 'jane.doe@users.noreply.github.com',
        },
      }),
    );
    expect(mockPullsCreate).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      title: 'Update onboarding template',
      body: 'body text',
      base: 'main',
      head: 'onboarding/template-eng/jane/1-ab',
      draft: true,
    });
    expect(mockRequestReviewers).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      pull_number: 7,
      reviewers: ['reviewer-1'],
    });
    expect(result).toEqual({
      url: 'https://github.com/o/r/pull/7',
      number: 7,
    });
  });

  it('tolerates an already-existing head branch', async () => {
    mockCreateRef.mockRejectedValue(
      Object.assign(new Error('Reference already exists'), { status: 422 }),
    );

    await expect(
      buildProvider().openPullRequest(openPrOptions()),
    ).resolves.toEqual({ url: 'https://github.com/o/r/pull/7', number: 7 });
  });

  it('throws an actionable InputError when no credentials are configured', async () => {
    mockGetCredentials.mockResolvedValue({ headers: {} });

    await expect(
      buildProvider().openPullRequest(openPrOptions()),
    ).rejects.toThrow(
      /No GitHub credentials found for https:\/\/github\.com\/o\/r[\s\S]*app-config\.yaml/,
    );
  });

  it('throws an InputError when the repo URL has no owner/repo', async () => {
    await expect(
      buildProvider().getDefaultBranch('https://github.com/only-owner'),
    ).rejects.toThrow(/Cannot parse owner\/repo/);
  });
});
