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
import {
  mockCredentials,
  mockServices,
  startTestBackend,
} from '@backstage/backend-test-utils';
import request from 'supertest';
import type { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';
import { onboardingPlugin } from './plugin';
import { onboardingVcsExtensionPoint } from './extensions';
import { onboardingModuleDefaultVcs } from './module';

const mockReposGet = jest.fn();
const mockGetRef = jest.fn();
const mockCreateRef = jest.fn();
const mockGetContent = jest.fn();
const mockCreateOrUpdateFileContents = jest.fn();
const mockPullsCreate = jest.fn();

jest.mock('octokit', () => ({
  Octokit: class MockOctokit {
    rest = {
      repos: {
        get: mockReposGet,
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
      git: { getRef: mockGetRef, createRef: mockCreateRef },
      pulls: { create: mockPullsCreate, requestReviewers: jest.fn() },
    };
  },
}));

const validTemplate = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: { name: 'eng', title: 'Engineer' },
  spec: { role: 'engineer', phases: [] },
};

const githubConfig = {
  integrations: { github: [{ host: 'github.com', token: 'fake-token' }] },
};

async function seedDraft(server: any) {
  const res = await request(server)
    .put('/api/onboarding/templates/eng/draft')
    .set('Authorization', mockCredentials.user.header())
    .send({ template: validTemplate });
  expect(res.status).toBe(200);
}

async function publish(server: any) {
  return request(server)
    .post('/api/onboarding/templates/eng/publish')
    .set('Authorization', mockCredentials.user.header())
    .send({
      title: 'Update onboarding template',
      repoUrl: 'https://github.com/o/r',
      filePath: 'catalog/onboarding/eng.yaml',
    });
}

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

  it('accepts multiple providers through addVcsProvider', async () => {
    const multiModule = createBackendModule({
      pluginId: 'onboarding',
      moduleId: 'multi-vcs',
      register(reg) {
        reg.registerInit({
          deps: { vcs: onboardingVcsExtensionPoint },
          async init({ vcs }) {
            vcs.addVcsProvider({ ...stubVcs, id: 'a' });
            vcs.addVcsProvider({ ...stubVcs, id: 'b' });
          },
        });
      },
    });

    const backend = await startTestBackend({
      features: [onboardingPlugin, multiModule],
    });
    expect(backend).toBeDefined();
    await backend.stop();
  });
});

describe('onboardingPlugin default VCS providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'base-sha' } } });
    mockCreateRef.mockResolvedValue({ data: {} });
    mockGetContent.mockRejectedValue(
      Object.assign(new Error('Not Found'), { status: 404 }),
    );
    mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });
    mockPullsCreate.mockResolvedValue({
      data: { html_url: 'https://github.com/o/r/pull/7', number: 7 },
    });
  });

  it('registers the built-in providers when no module supplied one', async () => {
    const backend = await startTestBackend({
      features: [
        onboardingPlugin,
        mockServices.rootConfig.factory({ data: githubConfig }),
      ],
    });
    await seedDraft(backend.server);

    const res = await publish(backend.server);

    expect(res.status).toBe(200);
    expect(res.body.providerId).toBe('github');
    expect(res.body.url).toBe('https://github.com/o/r/pull/7');
    expect(res.body.number).toBe(7);
    expect(mockPullsCreate).toHaveBeenCalled();
    await backend.stop();
  });

  it('registers the built-in providers through the explicit /alpha module', async () => {
    const backend = await startTestBackend({
      features: [
        onboardingPlugin,
        onboardingModuleDefaultVcs,
        mockServices.rootConfig.factory({
          data: {
            ...githubConfig,
            onboarding: { publish: { autoRegisterDefaultProviders: false } },
          },
        }),
      ],
    });
    await seedDraft(backend.server);

    const res = await publish(backend.server);

    expect(res.status).toBe(200);
    expect(res.body.providerId).toBe('github');
    await backend.stop();
  });

  it('prefers an explicitly registered provider over the built-ins', async () => {
    const explicit = {
      id: 'custom',
      getDefaultBranch: jest.fn().mockResolvedValue('main'),
      openPullRequest: jest
        .fn()
        .mockResolvedValue({ url: 'http://custom/pr/1', number: 1 }),
    };
    const customModule = createBackendModule({
      pluginId: 'onboarding',
      moduleId: 'custom-vcs',
      register(reg) {
        reg.registerInit({
          deps: { vcs: onboardingVcsExtensionPoint },
          async init({ vcs }) {
            vcs.addVcsProvider(explicit);
          },
        });
      },
    });

    const backend = await startTestBackend({
      features: [
        onboardingPlugin,
        customModule,
        mockServices.rootConfig.factory({ data: githubConfig }),
      ],
    });
    await seedDraft(backend.server);

    const res = await publish(backend.server);

    expect(res.status).toBe(200);
    expect(res.body.providerId).toBe('custom');
    expect(explicit.openPullRequest).toHaveBeenCalled();
    expect(mockPullsCreate).not.toHaveBeenCalled();
    await backend.stop();
  });

  it('does not auto-register when autoRegisterDefaultProviders is false', async () => {
    const backend = await startTestBackend({
      features: [
        onboardingPlugin,
        mockServices.rootConfig.factory({
          data: {
            ...githubConfig,
            onboarding: { publish: { autoRegisterDefaultProviders: false } },
          },
        }),
      ],
    });
    await seedDraft(backend.server);

    const res = await publish(backend.server);

    expect(res.status).toBe(400);
    expect(res.body.error.name).toBe('InputError');
    expect(mockPullsCreate).not.toHaveBeenCalled();
    await backend.stop();
  });

  it('never responds 501 to publish', async () => {
    const backend = await startTestBackend({ features: [onboardingPlugin] });
    await seedDraft(backend.server);

    const res = await publish(backend.server);

    expect(res.status).not.toBe(501);
    await backend.stop();
  });
});
