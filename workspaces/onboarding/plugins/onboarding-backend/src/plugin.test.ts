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

import { createBackendModule } from '@backstage/backend-plugin-api';
import { startTestBackend } from '@backstage/backend-test-utils';
import type { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';
import { onboardingPlugin } from './plugin';
import { onboardingVcsExtensionPoint } from './extensions';

describe('onboardingPlugin VCS extension point wiring', () => {
  const stubVcs: OnboardingVcsProvider = {
    getDefaultBranch: jest.fn().mockResolvedValue('main'),
    openPullRequest: jest
      .fn()
      .mockResolvedValue({ url: 'http://pr/1', number: 1 }),
  };

  it('registers a VCS provider through onboardingVcsExtensionPoint', async () => {
    const vcsModule = createBackendModule({
      pluginId: 'onboarding',
      moduleId: 'test-vcs',
      register(reg) {
        reg.registerInit({
          deps: { vcs: onboardingVcsExtensionPoint },
          async init({ vcs }) {
            vcs.setVcsProvider(stubVcs);
          },
        });
      },
    });

    const backend = await startTestBackend({
      features: [onboardingPlugin, vcsModule],
    });
    expect(backend).toBeDefined();
    await backend.stop();
  });

  it('throws when a second VCS provider is set', async () => {
    const doubleModule = createBackendModule({
      pluginId: 'onboarding',
      moduleId: 'double-vcs',
      register(reg) {
        reg.registerInit({
          deps: { vcs: onboardingVcsExtensionPoint },
          async init({ vcs }) {
            vcs.setVcsProvider(stubVcs);
            vcs.setVcsProvider(stubVcs);
          },
        });
      },
    });

    await expect(
      startTestBackend({ features: [onboardingPlugin, doubleModule] }),
    ).rejects.toThrow(/a VCS provider was already set/);
  });
});
