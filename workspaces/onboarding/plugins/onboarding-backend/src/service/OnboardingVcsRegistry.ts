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

import type { OnboardingVcsProvider } from '@estehsaan/backstage-plugin-onboarding-common';

/**
 * Ordered registry of {@link OnboardingVcsProvider} implementations, populated
 * through `onboardingVcsExtensionPoint` (and, as a fallback, by the plugin's
 * own built-in providers).
 *
 * Resolution mirrors techdocs-editor's `VcsProviderRegistry`: the first
 * provider whose `canHandle` matches the repository URL wins. A provider
 * without `canHandle` is a catch-all and is only consulted when no scoped
 * provider matches, so pre-registry single-provider registrations keep working
 * without shadowing the built-ins.
 *
 * @public
 */
export class OnboardingVcsRegistry {
  private readonly providers: OnboardingVcsProvider[] = [];

  /** Appends a provider to the end of the resolution order. */
  register(provider: OnboardingVcsProvider): void {
    this.providers.push(provider);
  }

  /** Returns the first provider that can handle the URL, or undefined. */
  getForUrl(repoUrl: string): OnboardingVcsProvider | undefined {
    const scoped = this.providers.find(p => p.canHandle?.(repoUrl));
    if (scoped) {
      return scoped;
    }
    return this.providers.find(p => !p.canHandle);
  }

  /** All registered providers, in resolution order. */
  all(): OnboardingVcsProvider[] {
    return [...this.providers];
  }

  /** Ids of all registered providers, for diagnostics in error messages. */
  ids(): string[] {
    return this.providers.map(p => p.id ?? '<unnamed>');
  }

  /** Whether no provider has been registered at all. */
  isEmpty(): boolean {
    return this.providers.length === 0;
  }
}
