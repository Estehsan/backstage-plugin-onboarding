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

import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { OnboardingClient } from './OnboardingClient';
import { OnboardingProgress, TeamJoinerSummary } from '../types';

describe('OnboardingClient', () => {
  const baseUrl = 'http://backstage.test/api/onboarding';

  const discoveryApi: jest.Mocked<DiscoveryApi> = {
    getBaseUrl: jest.fn().mockResolvedValue(baseUrl),
  };

  const fetchApi: jest.Mocked<FetchApi> = {
    fetch: jest.fn(),
  };

  const createClient = () => new OnboardingClient({ discoveryApi, fetchApi });

  const okResponse = (body: unknown): Response =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as Response;

  beforeEach(() => {
    jest.clearAllMocks();
    discoveryApi.getBaseUrl.mockResolvedValue(baseUrl);
  });

  it('returns parsed JSON from a successful GET against the discovery base url', async () => {
    const progress: OnboardingProgress = {
      userId: 'user:default/jane.doe',
      templateName: 'backend-template',
      startDate: '2026-01-01T00:00:00.000Z',
      tasks: [{ taskId: 'setup-env', status: 'pending' }],
    };
    fetchApi.fetch.mockResolvedValue(okResponse(progress));

    const result = await createClient().getProgress('user:default/jane.doe');

    expect(result).toEqual(progress);
    expect(discoveryApi.getBaseUrl).toHaveBeenCalledWith('onboarding');
    expect(fetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url] = fetchApi.fetch.mock.calls[0];
    expect(url).toBe(
      `${baseUrl}/progress/${encodeURIComponent('user:default/jane.doe')}`,
    );
  });

  it('encodes userId and taskId segments in the request path', async () => {
    fetchApi.fetch.mockResolvedValue(
      okResponse({
        userId: 'user:default/jane.doe',
        templateName: 'backend-template',
        startDate: '2026-01-01T00:00:00.000Z',
        tasks: [],
      }),
    );

    await createClient().updateTaskStatus(
      'user:default/jane.doe',
      'task/with space',
      'done',
    );

    const [url, init] = fetchApi.fetch.mock.calls[0];
    expect(url).toBe(
      `${baseUrl}/progress/${encodeURIComponent(
        'user:default/jane.doe',
      )}/tasks/${encodeURIComponent('task/with space')}`,
    );
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('throws a ResponseError carrying the 404 status when the backend responds with 404', async () => {
    fetchApi.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      url: `${baseUrl}/progress/user:default%2Fmissing`,
      text: async () =>
        JSON.stringify({
          error: { name: 'NotFoundError', message: 'no such user' },
          response: { statusCode: 404 },
        }),
    } as unknown as Response);

    const promise = createClient().getProgress('user:default/missing');

    await expect(promise).rejects.toBeInstanceOf(ResponseError);
    await expect(promise).rejects.toMatchObject({
      name: 'ResponseError',
      cause: { name: 'NotFoundError', message: 'no such user' },
    });
  });

  describe('assignTemplate', () => {
    it('includes buddyUserId in POST body when provided', async () => {
      const progress: OnboardingProgress = {
        userId: 'user:default/alice',
        templateName: 'backend-template',
        startDate: '2026-01-01T00:00:00.000Z',
        tasks: [],
      };
      fetchApi.fetch.mockResolvedValue(okResponse(progress));

      await createClient().assignTemplate(
        'backend-template',
        'user:default/alice',
        'user:default/bob',
      );

      const [url, init] = fetchApi.fetch.mock.calls[0];
      expect(url).toBe(
        `${baseUrl}/templates/${encodeURIComponent(
          'backend-template',
        )}/assign/${encodeURIComponent('user:default/alice')}`,
      );
      expect(init).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(JSON.parse(init?.body as string)).toEqual({
        buddyUserId: 'user:default/bob',
      });
    });

    it('sends empty object in POST body when buddyUserId is undefined', async () => {
      const progress: OnboardingProgress = {
        userId: 'user:default/alice',
        templateName: 'backend-template',
        startDate: '2026-01-01T00:00:00.000Z',
        tasks: [],
      };
      fetchApi.fetch.mockResolvedValue(okResponse(progress));

      await createClient().assignTemplate(
        'backend-template',
        'user:default/alice',
      );

      const [, init] = fetchApi.fetch.mock.calls[0];
      expect(JSON.parse(init?.body as string)).toEqual({});
    });
  });

  describe('setBuddy', () => {
    it('posts to the correct URL with buddyUserId in body', async () => {
      fetchApi.fetch.mockResolvedValue(
        okResponse({
          userId: 'user:default/alice',
          buddyUserId: 'user:default/bob',
        }),
      );

      await createClient().setBuddy('user:default/alice', 'user:default/bob');

      const [url, init] = fetchApi.fetch.mock.calls[0];
      expect(url).toBe(
        `${baseUrl}/progress/${encodeURIComponent('user:default/alice')}/buddy`,
      );
      expect(init).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(JSON.parse(init?.body as string)).toEqual({
        buddyUserId: 'user:default/bob',
      });
    });

    it('sends null in body when buddyUserId is undefined', async () => {
      fetchApi.fetch.mockResolvedValue(
        okResponse({ userId: 'user:default/alice', buddyUserId: null }),
      );

      await createClient().setBuddy('user:default/alice', undefined);

      const [, init] = fetchApi.fetch.mock.calls[0];
      expect(JSON.parse(init?.body as string)).toEqual({ buddyUserId: null });
    });
  });

  describe('getMyTeams', () => {
    it('fetches teams from /teams/mine and returns parsed response', async () => {
      const teams = { teams: ['platform', 'devex'] };
      fetchApi.fetch.mockResolvedValue(okResponse(teams));

      const result = await createClient().getMyTeams();

      expect(result).toEqual(teams);
      const [url] = fetchApi.fetch.mock.calls[0];
      expect(url).toBe(`${baseUrl}/teams/mine`);
    });
  });

  describe('getIsAssigner', () => {
    it('fetches assigner status from /assigner/me and returns parsed response', async () => {
      const status = { isAssigner: true };
      fetchApi.fetch.mockResolvedValue(okResponse(status));

      const result = await createClient().getIsAssigner();

      expect(result).toEqual(status);
      const [url] = fetchApi.fetch.mock.calls[0];
      expect(url).toBe(`${baseUrl}/assigner/me`);
    });
  });

  describe('getMyBuddies', () => {
    it('fetches buddies from /buddies/mine and returns parsed array', async () => {
      const buddies: TeamJoinerSummary[] = [
        {
          userId: 'user:default/alice',
          displayName: 'Alice Smith',
          role: 'backend-engineer',
          startDate: '2026-01-01',
          completionPercent: 45,
          blockedTaskCount: 1,
          buddyUserId: 'user:default/charlie',
          buddyDisplayName: 'Charlie Brown',
        },
        {
          userId: 'user:default/bob',
          displayName: 'Bob Jones',
          role: 'frontend-engineer',
          startDate: '2026-01-15',
          completionPercent: 20,
          blockedTaskCount: 0,
        },
      ];
      fetchApi.fetch.mockResolvedValue(okResponse(buddies));

      const result = await createClient().getMyBuddies();

      expect(result).toEqual(buddies);
      const [url] = fetchApi.fetch.mock.calls[0];
      expect(url).toBe(`${baseUrl}/buddies/mine`);
    });
  });

  describe('Template Studio', () => {
    const template = {
      apiVersion: 'onboarding.backstage.io/v1',
      kind: 'OnboardingTemplate',
      metadata: { name: 'eng', title: 'Engineer' },
      spec: { role: 'engineer', phases: [] },
    } as any;

    it('saves a draft with a PUT to the draft endpoint', async () => {
      const draft = {
        name: 'eng',
        template,
        updatedAt: '2026-08-01T00:00:00.000Z',
        status: 'draft',
      };
      fetchApi.fetch.mockResolvedValue(okResponse(draft));

      const result = await createClient().saveTemplateDraft('eng', template);

      expect(result).toEqual(draft);
      const [url, init] = fetchApi.fetch.mock.calls[0];
      expect(url).toBe(`${baseUrl}/templates/eng/draft`);
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({
        template,
        sourceLocation: undefined,
      });
    });

    it('lists blocks and publishes via POST', async () => {
      fetchApi.fetch.mockResolvedValue(okResponse([]));
      await createClient().listBlocks();
      expect(fetchApi.fetch.mock.calls[0][0]).toBe(`${baseUrl}/blocks`);

      fetchApi.fetch.mockResolvedValue(
        okResponse({ url: 'http://pr/1', number: 1 }),
      );
      const res = await createClient().publishTemplate('eng', {
        title: 'Update template',
        repoUrl: 'https://github.com/o/r',
        filePath: 'eng.yaml',
      });
      expect(res).toEqual({ url: 'http://pr/1', number: 1 });
      const [url, init] = fetchApi.fetch.mock.calls[1];
      expect(url).toBe(`${baseUrl}/templates/eng/publish`);
      expect(init?.method).toBe('POST');
    });
  });
});
