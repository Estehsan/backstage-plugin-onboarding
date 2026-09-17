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
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter } from './service/router';
import { DatabaseOnboardingStore } from './service/OnboardingStore';
import { DatabaseTemplateDraftStore } from './service/TemplateDraftStore';
import { OnboardingVcsRegistry } from './service/OnboardingVcsRegistry';
import { createDefaultOnboardingVcsProviders } from './service/providers';
import { seedDemoData } from './service/seedDemoData';
import { onboardingVcsExtensionPoint } from './extensions';

/**
 * Backstage backend plugin for the onboarding checklist.
 * Registers the HTTP router and initialises the database store.
 *
 * @public
 */
export const onboardingPlugin = createBackendPlugin({
  pluginId: 'onboarding',
  register(env) {
    const vcsRegistry = new OnboardingVcsRegistry();
    let singleProviderSet = false;

    env.registerExtensionPoint(onboardingVcsExtensionPoint, {
      setVcsProvider(provider) {
        if (singleProviderSet) {
          throw new Error(
            'onboardingVcsExtensionPoint: a VCS provider was already set',
          );
        }
        singleProviderSet = true;
        vcsRegistry.register(provider);
      },
      addVcsProvider(provider) {
        vcsRegistry.register(provider);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        permissions: coreServices.permissions,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
      },
      async init({
        config,
        logger,
        database,
        permissions,
        httpRouter,
        httpAuth,
        auth,
        discovery,
      }) {
        const store = await DatabaseOnboardingStore.create({
          database,
          logger,
        });
        const draftStore = await DatabaseTemplateDraftStore.create({
          database,
          logger,
        });
        const catalogApi = new CatalogClient({
          discoveryApi: discovery,
          fetchApi: {
            fetch: async (input, init) => {
              const { token } = await auth.getPluginRequestToken({
                onBehalfOf: await auth.getOwnServiceCredentials(),
                targetPluginId: 'catalog',
              });
              const headers = new Headers(init?.headers);
              headers.set('Authorization', `Bearer ${token}`);
              return globalThis.fetch(input, { ...init, headers });
            },
          },
        });

        // Safety net: without this, a deployment that never adds
        // `@estehsaan/backstage-plugin-onboarding-backend/alpha` (or its own
        // module) has no provider at all and publishing cannot work. An
        // explicitly registered provider always takes precedence, since it is
        // registered before init runs and the registry resolves in order.
        const autoRegister =
          config.getOptionalBoolean(
            'onboarding.publish.autoRegisterDefaultProviders',
          ) ?? true;
        if (vcsRegistry.isEmpty() && autoRegister) {
          for (const provider of createDefaultOnboardingVcsProviders(config)) {
            vcsRegistry.register(provider);
          }
          logger.info(
            `Onboarding: no VCS provider was registered, falling back to the built-in providers [${vcsRegistry
              .ids()
              .join(', ')}]`,
          );
        }

        httpRouter.use(
          await createRouter({
            logger,
            config,
            store,
            draftStore,
            permissions,
            httpAuth,
            catalogApi,
            vcs: vcsRegistry,
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
