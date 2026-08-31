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

import type { VcsProvider } from '@estehsaan/backstage-plugin-techdocs-editor-node';
import type { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';
import { onboardingVcsExtensionPoint } from './extensions';

describe('onboardingVcsExtensionPoint', () => {
  it('is exported with the stable id onboarding.vcs', () => {
    // The extension point token carries its id; assert it stays stable so
    // adopters registering a module against `onboarding.vcs` keep working.
    expect((onboardingVcsExtensionPoint as unknown as { id: string }).id).toBe(
      'onboarding.vcs',
    );
  });

  it('accepts a techdocs-editor-node VcsProvider structurally', () => {
    // Compile-time guarantee: a real techdocs-editor-node VcsProvider is
    // assignable to OnboardingVcsProvider with no adapter. Drift in either
    // interface (parameter/return types) breaks this build.
    const assign = (p: VcsProvider): OnboardingVcsProvider => p;
    expect(typeof assign).toBe('function');
  });
});
