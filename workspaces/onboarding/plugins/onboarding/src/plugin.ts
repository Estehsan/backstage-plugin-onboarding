/*
 * Copyright 2024 Ehsan Tehrani
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
  createApiFactory,
  createPlugin,
  createRoutableExtension,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';
import { onboardingApiRef } from './api/OnboardingApi';
import { OnboardingClient } from './api/OnboardingClient';

/** @public */
export const onboardingPlugin = createPlugin({
  id: 'onboarding',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: onboardingApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new OnboardingClient({ discoveryApi, fetchApi }),
    }),
  ],
});

/** @public */
export const OnboardingPage = onboardingPlugin.provide(
  createRoutableExtension({
    name: 'OnboardingPage',
    component: () =>
      import('./components/OnboardingPage/OnboardingPage').then(
        m => m.OnboardingPage,
      ),
    mountPoint: rootRouteRef,
  }),
);
