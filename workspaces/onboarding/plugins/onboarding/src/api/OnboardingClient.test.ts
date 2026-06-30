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
import { OnboardingProgress } from '../types';

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
    } as unknown as Response);

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
});
