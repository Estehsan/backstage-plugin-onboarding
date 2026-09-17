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
 * Minimal GitLab implementation of {@link OnboardingVcsProvider}, built on the
 * standard Backstage `integrations.gitlab` configuration. Supports self-hosted
 * instances, since the host is taken from the repository URL and matched
 * against the configured integrations.
 *
 * @public
 */
export class GitlabOnboardingVcsProvider implements OnboardingVcsProvider {
  readonly id = 'gitlab';

  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      const integrations = ScmIntegrations.fromConfig(this.config);
      return integrations.gitlab.byHost(url.host) !== undefined;
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
    const integrations = ScmIntegrations.fromConfig(this.config);
    const integration = integrations.gitlab.byHost(url.host);
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
    return new Gitlab({ host: `${url.protocol}//${url.host}`, token });
  }

  private getProjectPath(repoUrl: string): string {
    return new URL(repoUrl).pathname.replace(/^\//, '').replace(/\.git$/, '');
  }
}
