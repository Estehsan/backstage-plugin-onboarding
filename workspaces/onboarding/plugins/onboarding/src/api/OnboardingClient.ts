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
  type PublishTemplateFailure as PublishTemplateFailureBody,
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

/**
 * Default per-request timeout. Publishing overrides this — see
 * {@link PUBLISH_TIMEOUT_MS}.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Opening a pull request is a multi-round-trip operation against an external
 * SCM (resolve default branch → create branch → commit → open PR), so the
 * generic 15s budget aborts legitimate in-flight publishes. 60s matches the
 * publish timeout in the design for this flow.
 */
const PUBLISH_TIMEOUT_MS = 60_000;

/**
 * Error thrown by {@link OnboardingClient.publishTemplate} when publishing
 * fails: a real `Error` carrying the canonical `PublishTemplateFailure` fields
 * from `-common`. `message` is already provider-attributed and safe to render;
 * `issues` is populated when the backend rejected the draft (HTTP 400).
 * @public
 */
export type PublishTemplateFailure = Error & PublishTemplateFailureBody;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseIssues(body: unknown): TemplateValidationIssue[] | undefined {
  if (!isRecord(body) || !Array.isArray(body.issues)) {
    return undefined;
  }
  const issues = body.issues.filter(
    (issue): issue is TemplateValidationIssue =>
      isRecord(issue) && typeof issue.message === 'string',
  );
  return issues.length > 0 ? issues : undefined;
}

/**
 * Maps a failed publish response onto a readable, provider-attributed error.
 * The backend may answer with the standard `{ error: { name, message } }`
 * envelope (provider 502s, the "no VCS provider" 400) or with the
 * validation-specific `{ issues }` body; anything else falls back to the
 * status plus the raw body.
 */
async function publishFailureFromResponse(
  res: Response,
): Promise<PublishTemplateFailure> {
  const rawBody = await res.text().catch(() => '');

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    parsed = undefined;
  }

  const issues = parseIssues(parsed);

  const envelope =
    isRecord(parsed) && isRecord(parsed.error) ? parsed.error : undefined;
  const envelopeMessage =
    typeof envelope?.message === 'string' && envelope.message
      ? envelope.message
      : undefined;

  let message: string;
  if (envelopeMessage) {
    message = envelopeMessage;
  } else if (issues) {
    const listed = issues
      .slice(0, 3)
      .map(issue => issue.message)
      .join('; ');
    message = `Template has ${issues.length} validation error${
      issues.length === 1 ? '' : 's'
    }: ${listed}`;
  } else {
    message = `Publishing failed (HTTP ${res.status})${
      rawBody ? `: ${rawBody}` : ''
    }`;
  }

  const error: PublishTemplateFailure = new Error(message);
  error.status = res.status;
  if (issues) {
    error.issues = issues;
  }
  return error;
}

/**
 * Guards against a provider returning a 200 with no usable pull-request data,
 * which would otherwise render a success state with `#undefined` and a dead
 * link.
 */
function assertPublishResponse(body: unknown): PublishTemplateResponse {
  if (
    !isRecord(body) ||
    typeof body.url !== 'string' ||
    body.url.length === 0 ||
    !Number.isFinite(body.number)
  ) {
    throw new Error(
      'Publish succeeded but the backend returned no pull request URL',
    );
  }
  return body as unknown as PublishTemplateResponse;
}

/**
 * Per-call overrides for {@link OnboardingClient.request}. Defaults preserve
 * the shared behaviour (15s budget, `ResponseError`, unvalidated JSON).
 */
interface RequestOptions<T> {
  timeoutMs?: number;
  /** Message used when the request is aborted by the timeout. */
  timeoutMessage?: string;
  /** Builds the error thrown for a non-ok response. */
  toError?: (res: Response) => Promise<Error>;
  /** Validates/narrows the parsed 200 body. */
  validate?: (body: unknown) => T;
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
      {
        timeoutMs: PUBLISH_TIMEOUT_MS,
        timeoutMessage:
          `Publishing timed out after ${PUBLISH_TIMEOUT_MS / 1000}s. ` +
          'The pull request may still have been created — check the repository before retrying.',
        toError: publishFailureFromResponse,
        validate: assertPublishResponse,
      },
    );
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    options?: RequestOptions<T>,
  ): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('onboarding');
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await this.fetchApi.fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(
          options?.timeoutMessage ??
            `Request to ${path} timed out after ${timeoutMs / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      if (options?.toError) {
        throw await options.toError(res);
      }
      // The DOM `Response` type satisfies `ConsumedResponse` at runtime; the
      // cast bridges the narrower `Headers` lib type used by this workspace.
      throw await ResponseError.fromResponse(
        res as unknown as ConsumedResponse & { text(): Promise<string> },
      );
    }

    const body = await res.json();
    return options?.validate ? options.validate(body) : (body as T);
  }
}
