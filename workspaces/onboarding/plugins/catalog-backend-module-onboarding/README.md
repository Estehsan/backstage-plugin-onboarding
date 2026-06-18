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

This registers the `OnboardingTemplateProcessor` which:

- Validates entities with `apiVersion: onboarding.backstage.io/v1` and `kind: OnboardingTemplate`
- Ensures `spec.phases` is present and is an array

## License

Apache-2.0
