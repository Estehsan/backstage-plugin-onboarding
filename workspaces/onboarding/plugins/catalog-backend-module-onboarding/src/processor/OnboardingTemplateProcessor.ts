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
import {
  CatalogProcessor,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { InputError } from '@backstage/errors';

/** Phase identifiers accepted in an OnboardingTemplate, mirroring the backend router. */
const VALID_PHASES = new Set(['day1', 'week1', 'week2', 'month1']);

/** Task types accepted in an OnboardingTemplate. */
const VALID_TASK_TYPES = new Set(['manual', 'automated']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Adds support for the OnboardingTemplate entity kind to the catalog.
 *
 * Validates that entities use the `onboarding.backstage.io/v1` apiVersion with
 * kind `OnboardingTemplate`, and performs structural validation of the template
 * spec (role, team, phases, tasks, task types, automation refs and dependsOn
 * references). It does not mutate or enrich entities.
 *
 * @public
 */
export class OnboardingTemplateProcessor implements CatalogProcessor {
  /** Returns the unique processor name used for registration. */
  getProcessorName(): string {
    return 'OnboardingTemplateProcessor';
  }

  /** Returns true for entities with the OnboardingTemplate apiVersion and kind. */
  async validateEntityKind(entity: Entity): Promise<boolean> {
    return (
      entity.apiVersion === 'onboarding.backstage.io/v1' &&
      entity.kind === 'OnboardingTemplate'
    );
  }

  /**
   * Validates the structure of an OnboardingTemplate entity spec, throwing an
   * {@link InputError} with a descriptive message on any violation. Entities of
   * other kinds are returned unchanged.
   */
  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'OnboardingTemplate') {
      return entity;
    }

    const name = entity.metadata.name;
    const spec = entity.spec as Record<string, unknown> | undefined;

    if (!spec) {
      throw new InputError(
        `OnboardingTemplate "${name}" is missing the required spec`,
      );
    }

    if (!isNonEmptyString(spec.role)) {
      throw new InputError(
        `OnboardingTemplate "${name}" must define a non-empty spec.role`,
      );
    }

    if (spec.team !== undefined && typeof spec.team !== 'string') {
      throw new InputError(
        `OnboardingTemplate "${name}" spec.team must be a string`,
      );
    }

    if (!Array.isArray(spec.phases)) {
      throw new InputError(
        `OnboardingTemplate "${name}" is missing required spec.phases array`,
      );
    }

    const seenTaskIds = new Set<string>();
    const allTaskIds = new Set<string>();
    const dependsOnByTask: { taskId: string; deps: string[] }[] = [];

    for (const phase of spec.phases) {
      const phaseRecord = phase as Record<string, unknown>;
      const phaseId = phaseRecord.id;

      if (typeof phaseId !== 'string' || !VALID_PHASES.has(phaseId)) {
        throw new InputError(
          `OnboardingTemplate "${name}" has an invalid phase id "${String(
            phaseId,
          )}". Must be one of: ${[...VALID_PHASES].join(', ')}`,
        );
      }

      if (!Array.isArray(phaseRecord.tasks)) {
        throw new InputError(
          `OnboardingTemplate "${name}" phase "${phaseId}" must define a tasks array`,
        );
      }

      for (const task of phaseRecord.tasks) {
        const taskRecord = task as Record<string, unknown>;
        const taskId = taskRecord.id;

        if (!isNonEmptyString(taskId)) {
          throw new InputError(
            `OnboardingTemplate "${name}" phase "${phaseId}" has a task with a missing or empty id`,
          );
        }

        if (seenTaskIds.has(taskId)) {
          throw new InputError(
            `OnboardingTemplate "${name}" has a duplicate task id "${taskId}"`,
          );
        }
        seenTaskIds.add(taskId);
        allTaskIds.add(taskId);

        const taskType = taskRecord.type;
        if (typeof taskType !== 'string' || !VALID_TASK_TYPES.has(taskType)) {
          throw new InputError(
            `OnboardingTemplate "${name}" task "${taskId}" has an invalid type "${String(
              taskType,
            )}". Must be one of: ${[...VALID_TASK_TYPES].join(', ')}`,
          );
        }

        if (
          taskType === 'automated' &&
          !isNonEmptyString(taskRecord.automationRef)
        ) {
          throw new InputError(
            `OnboardingTemplate "${name}" automated task "${taskId}" must define an automationRef`,
          );
        }

        if (taskRecord.dependsOn !== undefined) {
          if (!Array.isArray(taskRecord.dependsOn)) {
            throw new InputError(
              `OnboardingTemplate "${name}" task "${taskId}" dependsOn must be an array`,
            );
          }
          dependsOnByTask.push({
            taskId,
            deps: taskRecord.dependsOn as string[],
          });
        }
      }
    }

    // Validate dependsOn references after collecting all known task ids so that
    // forward references between phases are allowed.
    for (const { taskId, deps } of dependsOnByTask) {
      for (const depId of deps) {
        if (!allTaskIds.has(depId)) {
          throw new InputError(
            `OnboardingTemplate "${name}" task "${taskId}" depends on unknown task "${depId}"`,
          );
        }
      }
    }

    return entity;
  }
}
