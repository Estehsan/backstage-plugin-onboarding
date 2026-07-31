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

import { RootConfigService } from '@backstage/backend-plugin-api';
import { TemplateBlock } from '../types';

const BUILT_IN_BLOCKS: TemplateBlock[] = [
  {
    id: 'builtin:task-laptop-setup',
    kind: 'task',
    title: 'Set up laptop',
    description: 'Provision and configure the new hire’s development machine.',
    task: {
      phase: 'day1',
      title: 'Set up your laptop',
      description:
        'Install required tooling and configure access to internal systems.',
      type: 'manual',
      assignee: 'self',
      duePhase: 'day1',
      estimatedMinutes: 60,
    },
  },
  {
    id: 'builtin:task-meet-buddy',
    kind: 'task',
    title: 'Meet your onboarding buddy',
    description: 'Schedule an intro session with the assigned buddy.',
    task: {
      phase: 'day1',
      title: 'Meet your onboarding buddy',
      description: 'Introduce yourself and set up recurring check-ins.',
      type: 'manual',
      assignee: 'buddy',
      duePhase: 'day1',
      estimatedMinutes: 30,
    },
  },
  {
    id: 'builtin:phase-week1-basics',
    kind: 'phase',
    title: 'Week 1 basics',
    description: 'A starter set of first-week tasks.',
    phase: 'week1',
    tasks: [
      {
        phase: 'week1',
        title: 'Read the team handbook',
        description: 'Get familiar with team norms and processes.',
        type: 'manual',
        assignee: 'self',
        duePhase: 'week1',
        estimatedMinutes: 45,
      },
      {
        phase: 'week1',
        title: 'Complete access requests',
        description: 'Request access to the repositories and tools you need.',
        type: 'manual',
        assignee: 'manager',
        duePhase: 'week1',
        estimatedMinutes: 20,
      },
    ],
  },
];

/**
 * Returns the block library available to the Template Studio: built-in blocks
 * plus any additional blocks configured under `onboarding.blocks`.
 *
 * @public
 */
export function getBlockLibrary(config: RootConfigService): TemplateBlock[] {
  const configured =
    config.getOptionalConfigArray('onboarding.blocks')?.flatMap(block => {
      const id = block.getOptionalString('id');
      const kind = block.getOptionalString('kind');
      const title = block.getOptionalString('title');
      if (!id || !title || (kind !== 'task' && kind !== 'phase')) {
        return [];
      }
      const parsed: TemplateBlock = {
        id,
        kind,
        title,
        description: block.getOptionalString('description'),
        phase: block.getOptionalString('phase') as TemplateBlock['phase'],
      };
      return [parsed];
    }) ?? [];

  return [...BUILT_IN_BLOCKS, ...configured];
}
