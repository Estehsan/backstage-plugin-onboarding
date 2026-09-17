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
import { ScmIntegrations } from '@backstage/integration';
import type {
  OnboardingOpenPrOptions,
  OnboardingOpenPrResult,
  OnboardingVcsProvider,
} from '@estehsaan/backstage-plugin-onboarding-common';
import { Gitlab } from '@gitbeaker/rest';

/**
 * Constructs a Gitlab client. Extracted to a plain function (rather than
 * inlining `new Gitlab(...)` at each call site) purely so its return type can
 * be captured with `ReturnType<typeof newGitlabClient>` below — `Gitlab` is
 * generic over a `Camelize` response-shape parameter that `InstanceType<typeof
 * Gitlab>` fails to resolve, but inference through a real call site works.
 */
function newGitlabClient(host: string, token: string) {
  return new Gitlab({ host, token });
}

/**
 * Minimal GitLab implementation of {@link OnboardingVcsProvider}, built on the
 * standard Backstage `integrations.gitlab` configuration. Supports self-hosted
 * instances, since the host is taken from the repository URL and matched
 * against the configured integrations.
 *
 * @public
 */
export class GitlabOnboardingVcsProvider implements OnboardingVcsProvider {
  readonly id = 'gitlab';

  // Parsing `integrations.gitlab` out of the raw config is pure but not
  // free, and `canHandle` + `getClient` are both called at least once per
  // publish — cache it once instead of re-parsing config on every call.
  private readonly integrations: ScmIntegrations;

  // Gitlab clients are cheap to construct (no network round trip), but a
  // single publish still calls `getClient` twice for the same repoUrl
  // (`getDefaultBranch` then `openPullRequest`); caching by host avoids
  // rebuilding it and re-validating the token each time.
  private readonly clientCache = new Map<
    string,
    ReturnType<typeof newGitlabClient>
  >();

  constructor(config: Config) {
    this.integrations = ScmIntegrations.fromConfig(config);
  }

  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return this.integrations.gitlab.byHost(url.host) !== undefined;
    } catch {
      return false;
    }
  }

  async getDefaultBranch(repoUrl: string): Promise<string> {
    const client = this.getClient(repoUrl);
    const project = await client.Projects.show(this.getProjectPath(repoUrl));
    return project.default_branch ?? 'main';
  }

  async openPullRequest(
    opts: OnboardingOpenPrOptions,
  ): Promise<OnboardingOpenPrResult> {
    const client = this.getClient(opts.repoUrl);
    const projectPath = this.getProjectPath(opts.repoUrl);

    try {
      await client.Branches.create(
        projectPath,
        opts.headBranch,
        opts.baseBranch,
      );
    } catch (branchErr: any) {
      const msg: string =
        branchErr?.cause?.description ??
        branchErr?.message ??
        String(branchErr);
      if (!msg.toLocaleLowerCase('en-US').includes('branch already exists')) {
        throw branchErr;
      }
    }

    const actions: any[] = [];
    for (const [filePath, file] of opts.files) {
      if (file === null) {
        actions.push({ action: 'delete', file_path: filePath });
        continue;
      }
      let fileExists = false;
      try {
        await client.RepositoryFiles.show(
          projectPath,
          filePath,
          opts.baseBranch,
        );
        fileExists = true;
      } catch {
        // New file.
      }
      const encoding = file.encoding ?? 'utf8';
      actions.push({
        action: fileExists ? 'update' : 'create',
        file_path: filePath,
        content: file.content,
        encoding: encoding === 'base64' ? 'base64' : 'text',
      });
    }

    await client.Commits.create(
      projectPath,
      opts.headBranch,
      opts.commitMessage,
      actions,
      { authorName: opts.authorName, authorEmail: opts.authorEmail },
    );

    const mr = await client.MergeRequests.create(
      projectPath,
      opts.headBranch,
      opts.baseBranch,
      opts.title,
      {
        description: opts.description ?? '',
        ...(opts.draft ? { draft: true } : {}),
      } as any,
    );

    return { url: mr.web_url, number: mr.iid };
  }

  private getClient(repoUrl: string) {
    let url: URL;
    try {
      url = new URL(repoUrl);
    } catch {
      throw new InputError(`Cannot parse a GitLab project from: ${repoUrl}`);
    }

    const cached = this.clientCache.get(url.host);
    if (cached) {
      return cached;
    }

    const integration = this.integrations.gitlab.byHost(url.host);
    if (!integration) {
      throw new InputError(
        `No GitLab integration for host ${url.host}. ` +
          `Add it under integrations.gitlab in app-config.yaml.`,
      );
    }
    const token = integration.config.token;
    if (!token) {
      throw new InputError(
        `The GitLab integration for ${url.host} has no token configured. ` +
          `Set integrations.gitlab[].token in app-config.yaml.`,
      );
    }
    const client = newGitlabClient(`${url.protocol}//${url.host}`, token);
    this.clientCache.set(url.host, client);
    return client;
  }

  private getProjectPath(repoUrl: string): string {
    return new URL(repoUrl).pathname.replace(/^\//, '').replace(/\.git$/, '');
  }
}
