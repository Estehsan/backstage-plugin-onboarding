# @estehsaan/backstage-plugin-onboarding-backend

Backend for the Backstage onboarding checklist plugin. Provides API endpoints for managing onboarding progress, team stats, and template assignment.

## Installation

```bash
yarn --cwd packages/backend add @estehsaan/backstage-plugin-onboarding-backend
```

Add the backend plugin to `packages/backend/src/index.ts`:

```ts
backend.add(import('@estehsaan/backstage-plugin-onboarding-backend'));
```

If you want to define `OnboardingTemplate` entities in the catalog, also install and add the catalog backend module:

```bash
yarn --cwd packages/backend add @estehsaan/backstage-plugin-catalog-backend-module-onboarding
```

```ts
backend.add(
  import('@estehsaan/backstage-plugin-catalog-backend-module-onboarding'),
);
```

> **Note**: The catalog processor now lives in `@estehsaan/backstage-plugin-catalog-backend-module-onboarding`. It registers `OnboardingTemplateProcessor` with the catalog's processing extension point, enabling the `kind: OnboardingTemplate` entity kind. Without it, catalog YAML files with `kind: OnboardingTemplate` will be rejected.

## Template Loading

Templates are loaded with the following priority:

1. Catalog entities with `kind: OnboardingTemplate` fetched via the catalog API
2. Config-based fallback from `onboarding.templates.defaults`, used only when no catalog templates exist

### Config-Based Templates

```yaml
onboarding:
  templates:
    defaults:
      - name: generic-engineer
        title: Generic Engineer Onboarding
        phases: [day1, week1]
        tasks:
          - id: welcome-meeting
            phase: day1
            title: Attend welcome meeting
            type: manual
            assignee: self
```

## API Endpoints

| Method | Path                                                     | Description                                                   |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/onboarding/health`                                 | Health check                                                  |
| GET    | `/api/onboarding/progress/:userId`                       | Get user's onboarding progress                                |
| POST   | `/api/onboarding/progress/:userId/tasks/:taskId`         | Update a task status                                          |
| GET    | `/api/onboarding/team/:teamName/stats`                   | Get team onboarding stats                                     |
| GET    | `/api/onboarding/templates`                              | List all onboarding templates                                 |
| GET    | `/api/onboarding/users/search?query=`                    | Search catalog users for assignment (empty query lists users) |
| POST   | `/api/onboarding/templates/:templateName/assign/:userId` | Assign a template to a user                                   |

> **Note**: `:userId` is a full entity reference (e.g. `user:default/jane.doe`),
> which always contains a `/`. Routes that accept `:userId` match it as a
> greedy path segment so the request still resolves correctly even if a
> reverse proxy or gateway decodes the `%2F` in the URL to a literal `/`
> before forwarding the request to this backend (a known issue when running
> behind some identity-provider-integrated proxies, e.g. Entra ID).

### User search

`GET /users/search` reads `User` entities directly from the catalog and filters
them in memory across `metadata.name`, `metadata.title`,
`spec.profile.displayName`, and `spec.profile.email` (case-insensitive). It does
not depend on the catalog full-text index, so results are reliable even when the
search index is unpopulated. An empty `query` returns the available users
(sorted by display name) so the assignment picker can be browsed without typing.
The scan uses 1,000-user pages, up to 20,000 users per request, and returns at
most 50 matches. Type a name or email to find users outside the initial list.
If the scan limit is reached, the backend logs a warning because results may
be incomplete. Requires the `onboarding.template.assign` permission and,
when configured, membership in an `onboarding.defaults.assignerGroups` group.

## Optional TechDocs Editor Integration (template publishing)

`POST /templates/:templateName/publish` opens a pull/merge request with the
generated `OnboardingTemplate` YAML. It needs a version-control provider, which is
**injected** — the backend has **no compile-time dependency** on
`@estehsaan/backstage-plugin-techdocs-editor-node`.

- **No provider registered (default):** the endpoint returns `501 Not Implemented`
  (`NotImplementedError`). Every other endpoint works normally.
- **Provider registered:** the endpoint opens a PR/MR via the provider.

Register a provider through the `onboardingVcsExtensionPoint`, exported from the
`/alpha` sub-path:

```ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { onboardingVcsExtensionPoint } from '@estehsaan/backstage-plugin-onboarding-backend/alpha';

const onboardingVcsModule = createBackendModule({
  pluginId: 'onboarding',
  moduleId: 'vcs-provider',
  register(reg) {
    reg.registerInit({
      deps: { vcs: onboardingVcsExtensionPoint },
      async init({ vcs }) {
        // A techdocs-editor-node `VcsProvider` satisfies `OnboardingVcsProvider`
        // structurally, so it can be passed with no adapter. `setVcsProvider`
        // throws if called more than once.
        vcs.setVcsProvider(myVcsProvider);
      },
    });
  },
});
```

The injected surface is the minimal `OnboardingVcsProvider` interface from
`@estehsaan/backstage-plugin-onboarding-common` (`getDefaultBranch` +
`openPullRequest`). See the frontend plugin README's "Optional TechDocs Editor
Integration" section for the matching editor wiring.

## License

Apache-2.0
