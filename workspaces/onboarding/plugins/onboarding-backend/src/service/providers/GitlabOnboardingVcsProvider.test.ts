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
import { GitlabOnboardingVcsProvider } from './GitlabOnboardingVcsProvider';

const mockProjectsShow = jest.fn();
const mockBranchesCreate = jest.fn();
const mockCommitsCreate = jest.fn();
const mockMergeRequestsCreate = jest.fn();
const mockRepositoryFilesShow = jest.fn();
const mockGitlabConstructor = jest.fn();

jest.mock('@gitbeaker/rest', () => ({
  Gitlab: class MockGitlab {
    Projects = { show: mockProjectsShow };
    Branches = { create: mockBranchesCreate };
    Commits = { create: mockCommitsCreate };
    MergeRequests = { create: mockMergeRequestsCreate };
    RepositoryFiles = { show: mockRepositoryFilesShow };

    constructor(...args: unknown[]) {
      mockGitlabConstructor(...args);
    }
  },
}));

const REPO_URL = 'https://gitlab.com/group/project';

function buildProvider(
  config = new ConfigReader({
    integrations: { gitlab: [{ host: 'gitlab.com', token: 'fake-token' }] },
  }),
) {
  return new GitlabOnboardingVcsProvider(config);
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
    authorEmail: 'jane.doe@example.com',
    ...overrides,
  } as any;
}

describe('GitlabOnboardingVcsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectsShow.mockResolvedValue({ default_branch: 'main' });
    mockBranchesCreate.mockResolvedValue({});
    mockCommitsCreate.mockResolvedValue({});
    mockRepositoryFilesShow.mockRejectedValue(new Error('404 Not Found'));
    mockMergeRequestsCreate.mockResolvedValue({
      web_url: 'https://gitlab.com/group/project/-/merge_requests/3',
      iid: 3,
    });
  });

  it('exposes the stable provider id "gitlab"', () => {
    expect(buildProvider().id).toBe('gitlab');
  });

  it('canHandle only matches hosts with a configured GitLab integration', () => {
    const provider = buildProvider();
    expect(provider.canHandle(REPO_URL)).toBe(true);
    expect(provider.canHandle('https://github.com/o/r')).toBe(false);
    expect(provider.canHandle('not a url')).toBe(false);
  });

  it('reads the default branch through the GitLab API', async () => {
    mockProjectsShow.mockResolvedValue({ default_branch: 'trunk' });
    await expect(buildProvider().getDefaultBranch(REPO_URL)).resolves.toBe(
      'trunk',
    );
    expect(mockProjectsShow).toHaveBeenCalledWith('group/project');
  });

  it('creates the branch, commit and merge request', async () => {
    const result = await buildProvider().openPullRequest(openPrOptions());

    expect(mockBranchesCreate).toHaveBeenCalledWith(
      'group/project',
      'onboarding/template-eng/jane/1-ab',
      'main',
    );
    expect(mockCommitsCreate).toHaveBeenCalledWith(
      'group/project',
      'onboarding/template-eng/jane/1-ab',
      'chore: update eng template',
      [
        {
          action: 'create',
          file_path: 'catalog/onboarding/eng.yaml',
          content: 'kind: X\n',
          encoding: 'text',
        },
      ],
      { authorName: 'jane.doe', authorEmail: 'jane.doe@example.com' },
    );
    expect(mockMergeRequestsCreate).toHaveBeenCalledWith(
      'group/project',
      'onboarding/template-eng/jane/1-ab',
      'main',
      'Update onboarding template',
      expect.objectContaining({ description: 'body text' }),
    );
    expect(result).toEqual({
      url: 'https://gitlab.com/group/project/-/merge_requests/3',
      number: 3,
    });
  });

  it('updates rather than creates a file that already exists on the base branch', async () => {
    mockRepositoryFilesShow.mockResolvedValue({ blob_id: 'abc' });

    await buildProvider().openPullRequest(openPrOptions());

    expect(mockCommitsCreate).toHaveBeenCalledWith(
      'group/project',
      expect.any(String),
      expect.any(String),
      [expect.objectContaining({ action: 'update' })],
      expect.any(Object),
    );
  });

  it('tolerates an already-existing head branch', async () => {
    mockBranchesCreate.mockRejectedValue(new Error('Branch already exists'));

    await expect(
      buildProvider().openPullRequest(openPrOptions()),
    ).resolves.toEqual({
      url: 'https://gitlab.com/group/project/-/merge_requests/3',
      number: 3,
    });
  });

  it('throws an actionable InputError when the host has no integration', async () => {
    await expect(
      buildProvider().getDefaultBranch('https://gitlab.acme.com/g/p'),
    ).rejects.toThrow(
      /No GitLab integration for host gitlab\.acme\.com[\s\S]*app-config\.yaml/,
    );
  });

  it('throws an actionable InputError when the integration has no token', async () => {
    const provider = buildProvider(
      new ConfigReader({
        integrations: { gitlab: [{ host: 'gitlab.com' }] },
      }),
    );

    await expect(provider.getDefaultBranch(REPO_URL)).rejects.toThrow(
      /no token configured[\s\S]*app-config\.yaml/,
    );
  });

  it('builds one client per host and reuses it across calls', async () => {
    const provider = buildProvider();

    // A real publish calls getDefaultBranch() then openPullRequest() for the
    // same repoUrl; both should share one cached client instead of each
    // re-validating the integration/token from scratch.
    await provider.getDefaultBranch(REPO_URL);
    await provider.openPullRequest(openPrOptions());

    expect(mockGitlabConstructor).toHaveBeenCalledTimes(1);
  });
});
