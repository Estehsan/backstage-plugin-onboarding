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

import { parse } from 'yaml';
import { templateToYaml } from './templateYaml';

it('emits a parseable OnboardingTemplate document', () => {
  const yaml = templateToYaml({
    apiVersion: 'onboarding.backstage.io/v1',
    kind: 'OnboardingTemplate',
    metadata: { name: 'eng', title: 'Engineer' },
    spec: { role: 'engineer', phases: [] },
  } as any);
  const parsed = parse(yaml);
  expect(parsed.kind).toBe('OnboardingTemplate');
  expect(parsed.metadata.name).toBe('eng');
  // apiVersion must come first for readable diffs.
  expect(yaml.trimStart().startsWith('apiVersion:')).toBe(true);
});
