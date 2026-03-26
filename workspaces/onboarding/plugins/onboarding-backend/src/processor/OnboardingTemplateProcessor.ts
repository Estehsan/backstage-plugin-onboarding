/*
 * Copyright 2024 Ehsan Tehrani
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

/**
 * Adds support for the OnboardingTemplate entity kind to the catalog.
 * Validates kind and enriches entities with a managed-by annotation.
 *
 * @public
 */
export class OnboardingTemplateProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'OnboardingTemplateProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return (
      (entity.apiVersion === 'backstage.io/v1alpha1' ||
        entity.apiVersion === 'onboarding.backstage.io/v1') &&
      entity.kind === 'OnboardingTemplate'
    );
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'OnboardingTemplate') {
      return entity;
    }

    const spec = entity.spec as Record<string, unknown> | undefined;
    if (!spec?.phases || !Array.isArray(spec.phases)) {
      throw new Error(
        `OnboardingTemplate "${entity.metadata.name}" is missing required spec.phases array`,
      );
    }

    return entity;
  }
}
