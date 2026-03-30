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
