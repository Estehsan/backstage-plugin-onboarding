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

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { onboardingVcsExtensionPoint } from './extensions';
import { createDefaultOnboardingVcsProviders } from './service/providers';

/**
 * Backend module registering the built-in GitHub and GitLab VCS providers used
 * by `POST /templates/:name/publish`.
 *
 * Add it explicitly to your backend:
 *
 * ```ts
 * backend.add(import('@estehsaan/backstage-plugin-onboarding-backend'));
 * backend.add(import('@estehsaan/backstage-plugin-onboarding-backend/alpha'));
 * ```
 *
 * The plugin also auto-registers the same providers when nothing else feeds
 * the extension point, so existing installs keep working; set
 * `onboarding.publish.autoRegisterDefaultProviders: false` to require this
 * explicit wiring instead.
 *
 * @alpha
 */
export const onboardingModuleDefaultVcs = createBackendModule({
  pluginId: 'onboarding',
  moduleId: 'default-vcs',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        vcs: onboardingVcsExtensionPoint,
      },
      async init({ config, vcs }) {
        for (const provider of createDefaultOnboardingVcsProviders(config)) {
          vcs.addVcsProvider(provider);
        }
      },
    });
  },
});
