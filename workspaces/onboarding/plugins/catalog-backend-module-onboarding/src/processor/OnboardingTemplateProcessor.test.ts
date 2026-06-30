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

import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { OnboardingTemplateProcessor } from './OnboardingTemplateProcessor';

const location: LocationSpec = {
  type: 'url',
  target: 'https://example.com/onboarding.yaml',
};

const emit: CatalogProcessorEmit = () => {};

function template(spec: unknown): Entity {
  return {
    apiVersion: 'onboarding.backstage.io/v1',
    kind: 'OnboardingTemplate',
    metadata: { name: 'backend-engineer' },
    spec: spec as Record<string, unknown>,
  };
}

function validSpec(): Record<string, unknown> {
  return {
    role: 'backend-engineer',
    team: 'platform',
    phases: [
      {
        id: 'day1',
        tasks: [
          { id: 'setup-laptop', type: 'manual' },
          {
            id: 'run-scaffolder',
            type: 'automated',
            automationRef: 'template:default/repo',
            dependsOn: ['setup-laptop'],
          },
        ],
      },
      {
        id: 'week1',
        tasks: [{ id: 'meet-team', type: 'manual' }],
      },
    ],
  };
}

describe('OnboardingTemplateProcessor', () => {
  const processor = new OnboardingTemplateProcessor();

  describe('validateEntityKind', () => {
    it('returns true only for the correct apiVersion and kind', async () => {
      await expect(
        processor.validateEntityKind(template(validSpec())),
      ).resolves.toBe(true);

      await expect(
        processor.validateEntityKind({
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'OnboardingTemplate',
          metadata: { name: 'x' },
        } as Entity),
      ).resolves.toBe(false);

      await expect(
        processor.validateEntityKind({
          apiVersion: 'onboarding.backstage.io/v1',
          kind: 'Component',
          metadata: { name: 'x' },
        } as Entity),
      ).resolves.toBe(false);
    });
  });

  describe('preProcessEntity', () => {
    it('passes a fully valid template through unchanged', async () => {
      const entity = template(validSpec());
      await expect(
        processor.preProcessEntity(entity, location, emit),
      ).resolves.toBe(entity);
    });

    it('passes entities of a different kind through unchanged', async () => {
      const component: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'svc' },
        spec: { type: 'service' },
      };
      await expect(
        processor.preProcessEntity(component, location, emit),
      ).resolves.toBe(component);
    });

    it('throws when role is missing or empty', async () => {
      await expect(
        processor.preProcessEntity(
          template({ ...validSpec(), role: '' }),
          location,
          emit,
        ),
      ).rejects.toThrow(/non-empty spec.role/);
    });

    it('throws when team is not a string', async () => {
      await expect(
        processor.preProcessEntity(
          template({ ...validSpec(), team: 123 }),
          location,
          emit,
        ),
      ).rejects.toThrow(/spec.team must be a string/);
    });

    it('throws when phases is missing or not an array', async () => {
      await expect(
        processor.preProcessEntity(
          template({ role: 'r' }),
          location,
          emit,
        ),
      ).rejects.toThrow(/spec.phases array/);
    });

    it('throws on an invalid phase id', async () => {
      await expect(
        processor.preProcessEntity(
          template({
            role: 'r',
            phases: [{ id: 'day2', tasks: [] }],
          }),
          location,
          emit,
        ),
      ).rejects.toThrow(/invalid phase id "day2"/);
    });

    it('throws when a task is missing its id', async () => {
      await expect(
        processor.preProcessEntity(
          template({
            role: 'r',
            phases: [{ id: 'day1', tasks: [{ type: 'manual' }] }],
          }),
          location,
          emit,
        ),
      ).rejects.toThrow(/missing or empty id/);
    });

    it('throws on duplicate task ids across the template', async () => {
      await expect(
        processor.preProcessEntity(
          template({
            role: 'r',
            phases: [
              { id: 'day1', tasks: [{ id: 'dup', type: 'manual' }] },
              { id: 'week1', tasks: [{ id: 'dup', type: 'manual' }] },
            ],
          }),
          location,
          emit,
        ),
      ).rejects.toThrow(/duplicate task id "dup"/);
    });

    it('throws on an invalid task type', async () => {
      await expect(
        processor.preProcessEntity(
          template({
            role: 'r',
            phases: [{ id: 'day1', tasks: [{ id: 't', type: 'wizard' }] }],
          }),
          location,
          emit,
        ),
      ).rejects.toThrow(/invalid type "wizard"/);
    });

    it('throws when an automated task is missing automationRef', async () => {
      await expect(
        processor.preProcessEntity(
          template({
            role: 'r',
            phases: [{ id: 'day1', tasks: [{ id: 't', type: 'automated' }] }],
          }),
          location,
          emit,
        ),
      ).rejects.toThrow(/must define an automationRef/);
    });

    it('throws when dependsOn references an unknown task', async () => {
      await expect(
        processor.preProcessEntity(
          template({
            role: 'r',
            phases: [
              {
                id: 'day1',
                tasks: [
                  { id: 't', type: 'manual', dependsOn: ['does-not-exist'] },
                ],
              },
            ],
          }),
          location,
          emit,
        ),
      ).rejects.toThrow(/depends on unknown task "does-not-exist"/);
    });
  });
});
