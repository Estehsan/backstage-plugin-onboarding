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
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter } from './service/router';
import { DatabaseOnboardingStore } from './service/OnboardingStore';
import { seedDemoData } from './service/seedDemoData';

/** @public */
export const onboardingPlugin = createBackendPlugin({
  pluginId: 'onboarding',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        permissions: coreServices.permissions,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        discovery: coreServices.discovery,
      },
      async init({
        config,
        logger,
        database,
        permissions,
        httpRouter,
        httpAuth,
        discovery,
      }) {
        const store = await DatabaseOnboardingStore.create({ database });
        const catalogApi = new CatalogClient({ discoveryApi: discovery, fetchApi: { fetch: globalThis.fetch } });

        httpRouter.use(
          await createRouter({
            logger,
            config,
            store,
            permissions,
            httpAuth,
            catalogApi,
          }),
        );

        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });

        // Seed demo data in development
        if (config.getOptionalBoolean('onboarding.seedDemoData')) {
          await seedDemoData({ store, logger });
        }
      },
    });
  },
});
