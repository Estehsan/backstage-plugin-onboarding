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
backend.add(import('@estehsaan/backstage-plugin-catalog-backend-module-onboarding'));
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

| Method | Path                                                     | Description                    |
| ------ | -------------------------------------------------------- | ------------------------------ |
| GET    | `/api/onboarding/health`                                 | Health check                   |
| GET    | `/api/onboarding/progress/:userId`                       | Get user's onboarding progress |
| POST   | `/api/onboarding/progress/:userId/tasks/:taskId`         | Update a task status           |
| GET    | `/api/onboarding/team/:teamName/stats`                   | Get team onboarding stats      |
| GET    | `/api/onboarding/templates`                              | List all onboarding templates  |
| POST   | `/api/onboarding/templates/:templateName/assign/:userId` | Assign a template to a user    |

## License

Apache-2.0
