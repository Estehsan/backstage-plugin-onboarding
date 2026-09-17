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

import type {
  OnboardingVcsProvider,
  PublishTemplateFailure,
  PublishTemplateResponse,
  PublishTemplateValidationErrorBody,
} from './types';

describe('publish types', () => {
  it('requires the PR metadata fields on PublishTemplateResponse', () => {
    // Compile-time contract: every field below is required, so a backend that
    // forgets one fails the build instead of shipping a half-populated 200.
    const response: PublishTemplateResponse = {
      url: 'https://github.com/o/r/pull/7',
      number: 7,
      headBranch: 'onboarding/template-eng/jane.doe/123-abc',
      repoUrl: 'https://github.com/o/r',
      filePath: 'catalog/onboarding/eng.yaml',
      providerId: 'github',
    };

    expect(response.headBranch).toBe(
      'onboarding/template-eng/jane.doe/123-abc',
    );
    expect(response.repoUrl).toBe('https://github.com/o/r');
    expect(response.filePath).toBe('catalog/onboarding/eng.yaml');
    expect(response.providerId).toBe('github');
  });

  it('models the 400 validation envelope and the client-side failure shape', () => {
    const body: PublishTemplateValidationErrorBody = {
      issues: [
        { path: 'metadata.name', message: 'required', severity: 'error' },
      ],
      error: { name: 'InputError', message: 'Template eng has 1 error(s)' },
    };
    const failure: PublishTemplateFailure = {
      message: 'github failed to open a pull request',
      status: 502,
      issues: body.issues,
    };

    expect(body.error.name).toBe('InputError');
    expect(failure.issues).toHaveLength(1);
  });

  it('allows providers to declare an id and scope themselves to a repo URL', () => {
    const provider: OnboardingVcsProvider = {
      id: 'github',
      canHandle: (repoUrl: string) => repoUrl.includes('github.com'),
      getDefaultBranch: async () => 'main',
      openPullRequest: async () => ({ url: 'u', number: 1 }),
    };

    expect(provider.id).toBe('github');
    expect(provider.canHandle!('https://github.com/o/r')).toBe(true);

    // Backwards compatibility: both new members stay optional.
    const legacy: OnboardingVcsProvider = {
      getDefaultBranch: async () => 'main',
      openPullRequest: async () => ({ url: 'u', number: 1 }),
    };
    expect(legacy.id).toBeUndefined();
  });
});
