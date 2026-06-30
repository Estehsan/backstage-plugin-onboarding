<!--
Copyright 2026 Estehsan Tariq

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# @estehsaan/backstage-plugin-catalog-backend-module-onboarding

Catalog backend module that adds support for the `OnboardingTemplate` entity kind to Backstage.

## Installation

```bash
yarn --cwd packages/backend add @estehsaan/backstage-plugin-catalog-backend-module-onboarding
```

Add to `packages/backend/src/index.ts`:

```ts
backend.add(
  import('@estehsaan/backstage-plugin-catalog-backend-module-onboarding'),
);
```

This registers the `OnboardingTemplateProcessor` which validates entities with
`apiVersion: onboarding.backstage.io/v1` and `kind: OnboardingTemplate`. The
processor performs structural validation of the template spec and throws an
`InputError` (rejecting the entity) when any of the following is violated:

- `spec.role` is a non-empty string and `spec.team` (if present) is a string
- `spec.phases` is an array and every phase `id` is one of `day1`, `week1`,
  `week2`, `month1`
- each task has a non-empty `id`, with no duplicate task ids in the template
- each task `type` is `manual` or `automated`, and `automated` tasks define an
  `automationRef`
- every `dependsOn` entry references a task id defined in the same template

## License

Apache-2.0
