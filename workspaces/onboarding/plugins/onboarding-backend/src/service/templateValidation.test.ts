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

import { validateTemplate } from './templateValidation';

const base = {
  apiVersion: 'onboarding.backstage.io/v1',
  kind: 'OnboardingTemplate',
  metadata: { name: 'x', title: 'X' },
  spec: { role: 'eng', phases: [] },
} as any;

describe('validateTemplate', () => {
  it('passes a minimal valid template', () => {
    expect(validateTemplate(base)).toEqual([]);
  });

  it('flags missing metadata and role', () => {
    const issues = validateTemplate({
      apiVersion: 'onboarding.backstage.io/v1',
      kind: 'OnboardingTemplate',
      metadata: { name: '', title: '' },
      spec: { role: '', phases: [] },
    } as any);
    const paths = issues.map(i => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(['metadata.name', 'metadata.title', 'spec.role']),
    );
  });

  it('flags duplicate task ids, unknown dependsOn, and cycles', () => {
    const t = {
      ...base,
      spec: {
        role: 'eng',
        phases: [
          {
            id: 'day1',
            tasks: [
              {
                id: 'a',
                phase: 'day1',
                title: 'A',
                description: '',
                type: 'manual',
                assignee: 'self',
                duePhase: 'day1',
                dependsOn: ['b'],
              },
              {
                id: 'a',
                phase: 'day1',
                title: 'A2',
                description: '',
                type: 'manual',
                assignee: 'self',
                duePhase: 'day1',
              },
            ],
          },
        ],
      },
    };
    const issues = validateTemplate(t as any);
    const messages = issues.map(i => i.message).join(' | ');
    expect(messages).toMatch(/duplicate/i);
    expect(messages).toMatch(/unknown|does not exist/i);
  });

  it('detects dependency cycles and requires automationRef', () => {
    const t = {
      ...base,
      spec: {
        role: 'eng',
        phases: [
          {
            id: 'day1',
            tasks: [
              {
                id: 'a',
                phase: 'day1',
                title: 'A',
                type: 'manual',
                assignee: 'self',
                duePhase: 'day1',
                dependsOn: ['b'],
              },
              {
                id: 'b',
                phase: 'day1',
                title: 'B',
                type: 'automated',
                assignee: 'self',
                duePhase: 'day1',
                dependsOn: ['a'],
              },
            ],
          },
        ],
      },
    };
    const messages = validateTemplate(t as any)
      .map(i => i.message)
      .join(' | ');
    expect(messages).toMatch(/cycle/i);
    expect(messages).toMatch(/automationRef/i);
  });
});
