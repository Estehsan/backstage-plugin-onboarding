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

import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import {
  DefaultGithubCredentialsProvider,
  GithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import type {
  OnboardingOpenPrOptions,
  OnboardingOpenPrResult,
  OnboardingVcsProvider,
  OnboardingVcsWriteFile,
} from '@estehsaan/backstage-plugin-onboarding-common';
import { Octokit } from 'octokit';

/**
 * Minimal GitHub implementation of {@link OnboardingVcsProvider}, built on the
 * standard Backstage `integrations.github` configuration so it supports both
 * PAT and GitHub App credentials, plus GitHub Enterprise via `apiBaseUrl`.
 *
 * Self-contained on purpose: the onboarding publish flow only needs
 * `getDefaultBranch` and `openPullRequest`, so this avoids a runtime
 * dependency on another plugin's backend internals.
 *
 * @public
 */
export class GithubOnboardingVcsProvider implements OnboardingVcsProvider {
  readonly id = 'github';

  private readonly credentialsProvider: GithubCredentialsProvider;
  private readonly baseApiUrl: string;

  /**
   * A single publish (`getDefaultBranch` + `openPullRequest`) always targets
   * the same `repoUrl` twice. Without caching, each call independently
   * re-resolves credentials — a real network round trip for GitHub App
   * installation tokens — and builds a fresh `Octokit` client. Caching the
   * in-flight/resolved client per `repoUrl` collapses that to a single
   * credential exchange per publish.
   */
  private readonly octokitCache = new Map<string, Promise<Octokit>>();

  constructor(config: Config) {
    const integrations = ScmIntegrations.fromConfig(config);
    this.credentialsProvider =
      DefaultGithubCredentialsProvider.fromIntegrations(integrations);
    const ghIntegration = integrations.github.list()[0];
    this.baseApiUrl =
      ghIntegration?.config.apiBaseUrl ?? 'https://api.github.com';
  }

  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return (
        url.host === 'github.com' ||
        url.host.startsWith('github.') ||
        this.baseApiUrl.includes(url.host)
      );
    } catch {
      return false;
    }
  }

  async getDefaultBranch(repoUrl: string): Promise<string> {
    const { owner, repo } = this.parseRepo(repoUrl);
    const octokit = await this.getOctokit(repoUrl);
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return data.default_branch;
  }

  async openPullRequest(
    opts: OnboardingOpenPrOptions,
  ): Promise<OnboardingOpenPrResult> {
    const { owner, repo } = this.parseRepo(opts.repoUrl);
    const octokit = await this.getOctokit(opts.repoUrl);

    const { data: baseRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${opts.baseBranch}`,
    });

    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${opts.headBranch}`,
        sha: baseRef.object.sha,
      });
    } catch (err: any) {
      const message = String(err?.message ?? '');
      const alreadyExists =
        err?.status === 422 &&
        message.toLocaleLowerCase('en-US').includes('reference already exists');
      if (!alreadyExists) {
        throw err;
      }
    }

    for (const [filePath, file] of opts.files) {
      if (file === null) {
        continue;
      }
      await this.createOrUpdateFile({
        octokit,
        owner,
        repo,
        branch: opts.headBranch,
        filePath,
        file,
        message: opts.commitMessage,
        authorName: opts.authorName,
        authorEmail: opts.authorEmail,
      });
    }

    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      title: opts.title,
      body: opts.description ?? '',
      base: opts.baseBranch,
      head: opts.headBranch,
      draft: opts.draft ?? false,
    });

    if (!pr?.data) {
      throw new Error('Failed to create GitHub pull request');
    }

    if (opts.reviewers?.length) {
      await octokit.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: pr.data.number,
        reviewers: opts.reviewers,
      });
    }

    return { url: pr.data.html_url, number: pr.data.number };
  }

  private getOctokit(repoUrl: string): Promise<Octokit> {
    const cached = this.octokitCache.get(repoUrl);
    if (cached) {
      return cached;
    }
    const clientPromise = this.resolveOctokit(repoUrl).catch(err => {
      // Don't cache a failed resolution — a transient credential error
      // (e.g. a momentarily unreachable token endpoint) would otherwise
      // permanently poison this repoUrl for the lifetime of the provider.
      this.octokitCache.delete(repoUrl);
      throw err;
    });
    this.octokitCache.set(repoUrl, clientPromise);
    return clientPromise;
  }

  private async resolveOctokit(repoUrl: string): Promise<Octokit> {
    const credentials = await this.credentialsProvider.getCredentials({
      url: repoUrl,
    });
    const auth =
      credentials.token ??
      credentials.headers?.Authorization?.replace(/^token /i, '');
    if (!auth) {
      throw new InputError(
        `No GitHub credentials found for ${repoUrl}. ` +
          `Ensure a GitHub integration with a token is configured in app-config.yaml.`,
      );
    }
    return new Octokit({ auth, baseUrl: this.baseApiUrl });
  }

  private parseRepo(repoUrl: string): { owner: string; repo: string } {
    let url: URL;
    try {
      url = new URL(repoUrl);
    } catch {
      throw new InputError(`Cannot parse owner/repo from URL: ${repoUrl}`);
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new InputError(`Cannot parse owner/repo from URL: ${repoUrl}`);
    }
    return { owner: parts[0], repo: parts[1] };
  }

  private encodeFileContent(file: OnboardingVcsWriteFile): string {
    const encoding = file.encoding ?? 'utf8';
    if (encoding === 'base64') {
      return file.content;
    }
    return Buffer.from(file.content, 'utf-8').toString('base64');
  }

  private async readFileSha(opts: {
    octokit: Octokit;
    owner: string;
    repo: string;
    branch: string;
    filePath: string;
  }): Promise<string | undefined> {
    try {
      const response = await opts.octokit.rest.repos.getContent({
        owner: opts.owner,
        repo: opts.repo,
        path: opts.filePath,
        ref: opts.branch,
      });
      const data: any = response.data;
      if (Array.isArray(data)) {
        return undefined;
      }
      return data.sha;
    } catch (err: any) {
      if (err?.status === 404) {
        return undefined;
      }
      throw err;
    }
  }

  private async createOrUpdateFile(opts: {
    octokit: Octokit;
    owner: string;
    repo: string;
    branch: string;
    filePath: string;
    file: OnboardingVcsWriteFile;
    message: string;
    authorName: string;
    authorEmail: string;
  }): Promise<void> {
    const sha = await this.readFileSha({
      octokit: opts.octokit,
      owner: opts.owner,
      repo: opts.repo,
      branch: opts.branch,
      filePath: opts.filePath,
    });

    await opts.octokit.rest.repos.createOrUpdateFileContents({
      owner: opts.owner,
      repo: opts.repo,
      path: opts.filePath,
      branch: opts.branch,
      message: opts.message,
      content: this.encodeFileContent(opts.file),
      ...(sha ? { sha } : {}),
      committer: { name: opts.authorName, email: opts.authorEmail },
      author: { name: opts.authorName, email: opts.authorEmail },
    });
  }
}
