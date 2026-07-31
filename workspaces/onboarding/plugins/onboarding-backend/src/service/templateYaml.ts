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

import { stringify } from 'yaml';
import { OnboardingTemplate } from '../types';

/**
 * Serializes an OnboardingTemplate entity to a YAML document, emitting the
 * top-level keys in canonical `apiVersion, kind, metadata, spec` order.
 *
 * @public
 */
export function templateToYaml(template: OnboardingTemplate): string {
  const ordered = {
    apiVersion: template.apiVersion,
    kind: template.kind,
    metadata: template.metadata,
    spec: template.spec,
  };
  return stringify(ordered, { indent: 2 });
}
