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
import { OnboardingVcsRegistry } from './OnboardingVcsRegistry';

function provider(
  id: string,
  canHandle?: (repoUrl: string) => boolean,
): OnboardingVcsProvider {
  return {
    id,
    ...(canHandle ? { canHandle } : {}),
    getDefaultBranch: jest.fn().mockResolvedValue('main'),
    openPullRequest: jest.fn().mockResolvedValue({ url: 'u', number: 1 }),
  };
}

describe('OnboardingVcsRegistry', () => {
  it('is empty by default', () => {
    const registry = new OnboardingVcsRegistry();
    expect(registry.all()).toEqual([]);
    expect(registry.ids()).toEqual([]);
    expect(registry.isEmpty()).toBe(true);
    expect(registry.getForUrl('https://github.com/o/r')).toBeUndefined();
  });

  it('returns the first provider whose canHandle matches', () => {
    const github = provider('github', url => url.includes('github.com'));
    const gitlab = provider('gitlab', url => url.includes('gitlab.com'));
    const registry = new OnboardingVcsRegistry();
    registry.register(github);
    registry.register(gitlab);

    expect(registry.getForUrl('https://github.com/o/r')).toBe(github);
    expect(registry.getForUrl('https://gitlab.com/o/r')).toBe(gitlab);
    expect(registry.getForUrl('https://bitbucket.org/o/r')).toBeUndefined();
    expect(registry.ids()).toEqual(['github', 'gitlab']);
    expect(registry.isEmpty()).toBe(false);
  });

  it('treats a provider without canHandle as a catch-all used only as a fallback', () => {
    const github = provider('github', url => url.includes('github.com'));
    const legacy = provider('legacy');
    const registry = new OnboardingVcsRegistry();
    registry.register(github);
    registry.register(legacy);

    // A scoped provider always wins over the catch-all, regardless of order.
    expect(registry.getForUrl('https://github.com/o/r')).toBe(github);
    // Nothing scoped matches, so the catch-all handles it (legacy behaviour).
    expect(registry.getForUrl('https://bitbucket.org/o/r')).toBe(legacy);
  });

  it('exposes ids with a stable placeholder for unnamed providers', () => {
    const registry = new OnboardingVcsRegistry();
    registry.register({
      getDefaultBranch: jest.fn(),
      openPullRequest: jest.fn(),
    } as unknown as OnboardingVcsProvider);
    expect(registry.ids()).toEqual(['<unnamed>']);
  });
});
