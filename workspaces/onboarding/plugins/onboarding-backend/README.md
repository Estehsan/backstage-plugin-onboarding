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

## Template publishing (pull request creation)

`POST /templates/:templateName/publish` opens a pull/merge request with the
generated `OnboardingTemplate` YAML.

The plugin ships **built-in GitHub and GitLab providers** driven purely by the
standard `integrations.*` configuration, so publishing works out of the box:

```yaml
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN} # needs `repo` + pull request write scope
```

The token must be able to create branches and pull requests on the target
repository (a GitHub App installation with Contents: RW and Pull requests: RW
works too).

### Wiring

The providers are registered in one of three ways, in precedence order:

1. **A backend module you write** (see below) — always wins.
2. **The bundled `/alpha` module**, the preferred explicit wiring:

   ```ts
   backend.add(import('@estehsaan/backstage-plugin-onboarding-backend'));
   backend.add(import('@estehsaan/backstage-plugin-onboarding-backend/alpha'));
   ```

3. **Auto-registration fallback** — if nothing fed the extension point by the
   time the plugin initialises, it registers the same built-in providers
   itself, so existing installs need no app change. Disable with
   `onboarding.publish.autoRegisterDefaultProviders: false`.

To register your own provider (for example a techdocs-editor `VcsProvider`, or
an SCM this plugin does not implement), use the `onboardingVcsExtensionPoint`
exported from the `/alpha` sub-path:

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
        // structurally, so it can be passed with no adapter. Providers are
        // resolved in registration order by `canHandle(repoUrl)`; a provider
        // without `canHandle` acts as a catch-all.
        vcs.addVcsProvider(myVcsProvider);
      },
    });
  },
});
```

`setVcsProvider` is still supported for a single provider (and still throws if
called twice), but `addVcsProvider` is preferred.

The injected surface is the minimal `OnboardingVcsProvider` interface from
`@estehsaan/backstage-plugin-onboarding-common` (`getDefaultBranch` +
`openPullRequest`, plus the optional `id` and `canHandle`). See the frontend
plugin README's "Optional TechDocs Editor Integration" section for the matching
editor wiring.

### Publish responses

| Status | Condition                                                                |
| ------ | ------------------------------------------------------------------------ |
| 200    | PR opened — `{ url, number, headBranch, repoUrl, filePath, providerId }` |
| 400    | draft validation errors (`issues` plus a standard `error` envelope)      |
| 400    | missing `repoUrl`/`filePath`, or no provider matches the repository      |
| 403    | caller lacks `onboarding.template.write`                                 |
| 404    | no draft for the template                                                |
| 502    | the SCM provider call failed (`ProviderError`, with provider + repo)     |

The endpoint never returns `501`. A draft is only marked published after the
pull request has actually been created.

### Publish configuration

```yaml
onboarding:
  publish:
    # Commit author; defaults to the requesting user.
    authorName: Backstage Bot
    authorEmail: backstage@example.com
    # Set false to require explicit module wiring instead of the fallback.
    autoRegisterDefaultProviders: true
```

Publishing also needs a target location: either `repoUrl` + `filePath` in the
request body, or a draft `sourceLocation` of the form
`url:https://host/org/repo/blob/<ref>/<path>` (taken from the entity's
`backstage.io/managed-by-location` annotation).

## License

Apache-2.0
