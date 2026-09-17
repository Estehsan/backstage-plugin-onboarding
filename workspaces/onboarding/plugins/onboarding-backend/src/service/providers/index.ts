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
import type { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';
import { GithubOnboardingVcsProvider } from './GithubOnboardingVcsProvider';
import { GitlabOnboardingVcsProvider } from './GitlabOnboardingVcsProvider';

export { GithubOnboardingVcsProvider } from './GithubOnboardingVcsProvider';
export { GitlabOnboardingVcsProvider } from './GitlabOnboardingVcsProvider';

/**
 * The built-in providers, in resolution order. Shared by the `/alpha` module
 * and the plugin's auto-registration fallback so both register exactly the
 * same set.
 *
 * @public
 */
export function createDefaultOnboardingVcsProviders(
  config: Config,
): OnboardingVcsProvider[] {
  return [
    new GithubOnboardingVcsProvider(config),
    new GitlabOnboardingVcsProvider(config),
  ];
}
