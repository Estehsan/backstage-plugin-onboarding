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
  ApiBlueprint,
  createApiFactory,
  createFrontendPlugin,
  NavItemBlueprint,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import SchoolIcon from '@material-ui/icons/School';
import { rootRouteRef } from './routes';
import { onboardingApiRef } from './api/OnboardingApi';
import { OnboardingClient } from './api/OnboardingClient';

/**
 * Page extension for the Onboarding plugin.
 * @public
 */
export const OnboardingPageExtension = PageBlueprint.make({
  params: {
    path: '/onboarding',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/OnboardingPage/OnboardingPage').then(m => (
        <m.OnboardingPage />
      )),
  },
});

/**
 * Sidebar navigation item for the Onboarding plugin.
 * @public
 */
export const OnboardingNavItem = NavItemBlueprint.make({
  params: {
    title: 'Onboarding',
    icon: SchoolIcon,
    routeRef: rootRouteRef,
  },
});

/**
 * API extension providing the OnboardingApi factory.
 * @public
 */
export const OnboardingApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams(
      createApiFactory({
        api: onboardingApiRef,
        deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
        factory: ({ discoveryApi, fetchApi }) =>
          new OnboardingClient({ discoveryApi, fetchApi }),
      }),
    ),
});

/**
 * Entity card extension showing onboarding progress for a user entity.
 * @public
 */
export const EntityUserOnboardingCardExtension = EntityCardBlueprint.make({
  name: 'user-onboarding',
  params: {
    filter: 'kind:user',
    loader: () =>
      import('./components/EntityUserOnboardingCard/EntityUserOnboardingCard').then(
        m => <m.EntityUserOnboardingCard />,
      ),
  },
});

/**
 * The Onboarding Backstage plugin.
 * @public
 */
export const onboardingPlugin = createFrontendPlugin({
  pluginId: 'onboarding',
  info: { packageJson: () => import('../package.json') },
  routes: {
    root: rootRouteRef,
  },
  extensions: [
    OnboardingPageExtension,
    OnboardingNavItem,
    OnboardingApi,
    EntityUserOnboardingCardExtension,
  ],
});

import {
  createPlugin,
  createRoutableExtension,
  createApiFactory as createCoreApiFactory,
} from '@backstage/core-plugin-api';

/**
 * Legacy plugin for the old frontend system backwards compatibility.
 * @public
 */
export const legacyOnboardingPlugin = createPlugin({
  id: 'onboarding',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createCoreApiFactory({
      api: onboardingApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new OnboardingClient({ discoveryApi, fetchApi }),
    }),
  ],
});

/**
 * Routable extension for the old frontend system backwards compatibility.
 * @internal
 */
const OnboardingPageExtensionLegacy = legacyOnboardingPlugin.provide(
  createRoutableExtension({
    name: 'OnboardingPage',
    component: () =>
      import('./components/OnboardingPage/OnboardingPage').then(
        m => m.OnboardingPage,
      ),
    mountPoint: rootRouteRef,
  }),
);

/**
 * Page component for use with the legacy Backstage frontend system.
 *
 * Add it to your app routes in `packages/app/src/App.tsx`:
 * ```tsx
 * import { OnboardingPage } from '@estehsaan/backstage-plugin-onboarding';
 * <Route path="/onboarding" element={<OnboardingPage />} />
 * ```
 * @public
 */
export function OnboardingPage(): JSX.Element {
  return <OnboardingPageExtensionLegacy />;
}
