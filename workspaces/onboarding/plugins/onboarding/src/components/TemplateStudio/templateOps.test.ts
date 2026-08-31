/// <reference types="jest" />

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

import { OnboardingTemplate, Phase } from '../../types';
import { moveTask } from './templateOps';

function makeTemplate(): OnboardingTemplate {
  return {
    apiVersion: 'onboarding.backstage.io/v1',
    kind: 'OnboardingTemplate',
    metadata: { name: 'eng', title: 'Engineer', description: '' },
    spec: {
      role: 'engineer',
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
            },
            {
              id: 'b',
              phase: 'day1',
              title: 'B',
              description: '',
              type: 'manual',
              assignee: 'self',
              duePhase: 'day1',
            },
            {
              id: 'c',
              phase: 'day1',
              title: 'C',
              description: '',
              type: 'manual',
              assignee: 'self',
              duePhase: 'day1',
            },
          ],
        },
        {
          id: 'week1',
          tasks: [
            {
              id: 'd',
              phase: 'week1',
              title: 'D',
              description: '',
              type: 'manual',
              assignee: 'self',
              duePhase: 'week1',
            },
          ],
        },
      ],
    },
  };
}

function titles(template: OnboardingTemplate, phase: Phase): string[] {
  return template.spec.phases
    .find(p => p.id === phase)!
    .tasks.map(t => t.title);
}

describe('moveTask', () => {
  it('swaps a middle task up', () => {
    const result = moveTask(makeTemplate(), 'day1', 1, 'up');
    expect(titles(result, 'day1')).toEqual(['B', 'A', 'C']);
  });

  it('swaps a middle task down', () => {
    const result = moveTask(makeTemplate(), 'day1', 1, 'down');
    expect(titles(result, 'day1')).toEqual(['A', 'C', 'B']);
  });

  it('is a no-op when moving the first task up', () => {
    const template = makeTemplate();
    const result = moveTask(template, 'day1', 0, 'up');
    expect(titles(result, 'day1')).toEqual(['A', 'B', 'C']);
    expect(result).toEqual(template);
  });

  it('is a no-op when moving the last task down', () => {
    const template = makeTemplate();
    const result = moveTask(template, 'day1', 2, 'down');
    expect(titles(result, 'day1')).toEqual(['A', 'B', 'C']);
    expect(result).toEqual(template);
  });

  it('does not affect tasks in other phases', () => {
    const result = moveTask(makeTemplate(), 'day1', 0, 'down');
    expect(titles(result, 'week1')).toEqual(['D']);
  });
});
