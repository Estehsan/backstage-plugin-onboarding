# @estehsaan/backstage-plugin-onboarding-common

Shared types and permissions for the [`@estehsaan/backstage-plugin-onboarding`](https://www.npmjs.com/package/@estehsaan/backstage-plugin-onboarding) plugin.

## Installation

```bash
# From your Backstage root directory
yarn --cwd packages/backend add @estehsaan/backstage-plugin-onboarding-common
```

## Exported Types

- `TaskStatus`, `TaskType`, `Phase`, `ResourceType`
- `TaskResource`, `OnboardingTask`, `OnboardingTemplate`
- `OnboardingProgress`, `TeamOnboardingStats`

## Exported Permissions

- `onboardingProgressReadPermission`
- `onboardingProgressUpdatePermission`
- `onboardingTeamReadPermission`
- `onboardingTemplateAssignPermission`
- `onboardingPermissions` (array of all permissions)
