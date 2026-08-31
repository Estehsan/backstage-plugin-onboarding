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

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';

/**
 * Extension point for supplying the VCS provider used by
 * `POST /templates/:name/publish`. Register from a backend module.
 * @alpha
 */
export interface OnboardingVcsExtensionPoint {
  /**
   * Sets the VCS provider. Throws if called more than once.
   * A techdocs-editor-node `VcsProvider` satisfies `OnboardingVcsProvider`.
   */
  setVcsProvider(provider: OnboardingVcsProvider): void;
}

/**
 * Extension point id: `onboarding.vcs`.
 * @alpha
 */
export const onboardingVcsExtensionPoint =
  createExtensionPoint<OnboardingVcsExtensionPoint>({
    id: 'onboarding.vcs',
  });
