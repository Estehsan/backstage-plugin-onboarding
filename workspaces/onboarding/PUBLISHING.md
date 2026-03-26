# Publishing to npm

This guide walks you through publishing the onboarding plugin packages to npm under the `@estehsan` scope.

## Packages

| Package | Directory |
|---------|-----------|
| `@estehsan/backstage-plugin-onboarding` | `plugins/onboarding` |
| `@estehsan/backstage-plugin-onboarding-backend` | `plugins/onboarding-backend` |
| `@estehsan/backstage-plugin-onboarding-common` | `plugins/onboarding-common` |

## Prerequisites

1. **npm account** — Create one at https://www.npmjs.com/signup
2. **Login** — Run `npm login` and authenticate
3. **Scope access** — The first publish of an `@estehsan/*` package will create the scope automatically (tied to your npm username)

## Build & Publish (first time)

From the workspace root (`workspaces/onboarding/`):

```bash
# 1. Install dependencies
yarn install

# 2. Build all packages (common must be built first)
cd plugins/onboarding-common && yarn build && cd ../..
cd plugins/onboarding && yarn build && cd ../..
cd plugins/onboarding-backend && yarn build && cd ../..

# 3. Publish — common first (other packages depend on it)
cd plugins/onboarding-common && npm publish --access public && cd ../..
cd plugins/onboarding && npm publish --access public && cd ../..
cd plugins/onboarding-backend && npm publish --access public && cd ../..
```

## Subsequent Releases

1. Update the `version` field in each package's `package.json`
2. Rebuild and publish:

```bash
cd plugins/onboarding-common && yarn build && npm publish && cd ../..
cd plugins/onboarding && yarn build && npm publish && cd ../..
cd plugins/onboarding-backend && yarn build && npm publish && cd ../..
```

## For Consumers

Users install the packages in their own Backstage instance:

```bash
# Frontend
yarn --cwd packages/app add @estehsan/backstage-plugin-onboarding

# Backend
yarn --cwd packages/backend add @estehsan/backstage-plugin-onboarding-backend
```

Then wire them up:

**`packages/app/src/App.tsx`**:
```tsx
import { OnboardingPage } from '@estehsan/backstage-plugin-onboarding';

// In routes:
<Route path="/onboarding" element={<OnboardingPage />} />
```

**`packages/backend/src/index.ts`**:
```ts
backend.add(import('@estehsan/backstage-plugin-onboarding-backend'));
```
