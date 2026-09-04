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

import { parseEntityRef } from '@backstage/catalog-model';
import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError, type ConsumedResponse } from '@backstage/errors';
import { OnboardingApi } from './OnboardingApi';
import {
  OnboardingCatalogUser,
  OnboardingProgress,
  OnboardingTemplate,
  PublishTemplateRequest,
  PublishTemplateResponse,
  TaskStatus,
  TeamJoinerSummary,
  TeamOnboardingStats,
  TemplateBlock,
  TemplateDraft,
  TemplateValidationIssue,
} from '../types';

/**
 * Builds the `by-ref/:kind/:namespace/:name` path segment for a user entity
 * ref. Entity refs contain a `/` (e.g. `user:default/jdoe`), so a single
 * `encodeURIComponent`-encoded path segment relies on every reverse
 * proxy/gateway between the browser and this backend forwarding `%2F`
 * unmodified. Some proxies normalize or reject encoded slashes in a path,
 * producing a 404 that looks like a routing bug in this plugin but is
 * actually happening upstream of the request ever reaching Node. Splitting
 * the ref into three plain segments avoids the ambiguity entirely — the
 * same approach the core catalog backend uses for
 * `/entities/by-name/:kind/:namespace/:name`. Falls back to the legacy
 * combined-segment form (still supported by the backend) if `userId` isn't
 * a well-formed entity ref.
 */
function userRefPathSegment(userId: string): string {
  try {
    const { kind, namespace, name } = parseEntityRef(userId);
    return `by-ref/${encodeURIComponent(kind)}/${encodeURIComponent(
      namespace,
    )}/${encodeURIComponent(name)}`;
  } catch {
    return encodeURIComponent(userId);
  }
}

/** @public */
export class OnboardingClient implements OnboardingApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  // Spec 001 FR-002: backend now returns an array of progress records (one per
  // assigned template).
  async getProgressList(userId: string): Promise<OnboardingProgress[]> {
    return this.request<OnboardingProgress[]>(
      `/progress/${userRefPathSegment(userId)}`,
    );
  }

  async updateTaskStatus(
    userId: string,
    templateName: string,
    taskId: string,
    status: TaskStatus,
    blockedReason?: string,
  ): Promise<OnboardingProgress> {
    return this.request<OnboardingProgress>(
      `/progress/${userRefPathSegment(userId)}/tasks/${encodeURIComponent(
        taskId,
      )}`,
      {
        method: 'POST',
        // Spec 001 FR-004: send templateName in the body so the backend updates
        // the correct template's record (task IDs are only unique within a
        // template).
        body: JSON.stringify({ templateName, status, blockedReason }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  async getTeamStats(teamName: string): Promise<TeamOnboardingStats> {
    return this.request<TeamOnboardingStats>(
      `/team/${encodeURIComponent(teamName)}/stats`,
    );
  }

  async getTemplates(): Promise<OnboardingTemplate[]> {
    return this.request<OnboardingTemplate[]>('/templates');
  }

  async assignTemplate(
    templateName: string,
    userId: string,
    buddyUserId?: string,
  ): Promise<OnboardingProgress> {
    return this.request<OnboardingProgress>(
      `/templates/${encodeURIComponent(templateName)}/assign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...(buddyUserId ? { buddyUserId } : {}),
        }),
      },
    );
  }

  async searchCatalogUsers(query: string): Promise<OnboardingCatalogUser[]> {
    return this.request<OnboardingCatalogUser[]>(
      `/users/search?query=${encodeURIComponent(query)}`,
    );
  }

  async setBuddy(
    userId: string,
    buddyUserId: string | undefined,
  ): Promise<void> {
    await this.request<void>(`/progress/${userRefPathSegment(userId)}/buddy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buddyUserId: buddyUserId ?? null }),
    });
  }

  async getMyTeams(): Promise<{ teams: string[] }> {
    return this.request<{ teams: string[] }>('/teams/mine');
  }

  async getMyBuddies(): Promise<TeamJoinerSummary[]> {
    return this.request<TeamJoinerSummary[]>('/buddies/mine');
  }

  async getIsAssigner(): Promise<{ isAssigner: boolean }> {
    return this.request<{ isAssigner: boolean }>('/assigner/me');
  }

  async getTemplateDraft(name: string): Promise<TemplateDraft> {
    return this.request<TemplateDraft>(
      `/templates/${encodeURIComponent(name)}/draft`,
    );
  }

  async saveTemplateDraft(
    name: string,
    template: OnboardingTemplate,
    sourceLocation?: string,
  ): Promise<TemplateDraft> {
    return this.request<TemplateDraft>(
      `/templates/${encodeURIComponent(name)}/draft`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, sourceLocation }),
      },
    );
  }

  async createTemplateDraft(input: {
    name: string;
    role: string;
    title: string;
  }): Promise<TemplateDraft> {
    return this.request<TemplateDraft>('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async listBlocks(): Promise<TemplateBlock[]> {
    return this.request<TemplateBlock[]>('/blocks');
  }

  async validateTemplate(
    name: string,
    template: OnboardingTemplate,
  ): Promise<TemplateValidationIssue[]> {
    return this.request<TemplateValidationIssue[]>(
      `/templates/${encodeURIComponent(name)}/validate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      },
    );
  }

  async publishTemplate(
    name: string,
    request: PublishTemplateRequest,
  ): Promise<PublishTemplateResponse> {
    return this.request<PublishTemplateResponse>(
      `/templates/${encodeURIComponent(name)}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('onboarding');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let res: Response;
    try {
      res = await this.fetchApi.fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after 15s`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      // The DOM `Response` type satisfies `ConsumedResponse` at runtime; the
      // cast bridges the narrower `Headers` lib type used by this workspace.
      throw await ResponseError.fromResponse(
        res as unknown as ConsumedResponse & { text(): Promise<string> },
      );
    }

    return res.json() as Promise<T>;
  }
}
