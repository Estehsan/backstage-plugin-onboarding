# @estehsaan/backstage-plugin-onboarding

A structured, interactive onboarding checklist plugin for [Backstage](https://backstage.io) that guides new engineers through their first Day 1, Week 1, Week 2, and Month 1.

It replaces static Confluence/Notion docs with a live, trackable, automated checklist that both the new joiner and their manager/team lead can see.

<!-- TODO: Add a screenshot of the onboarding dashboard and replace this comment -->

## Features

- **Phase-based task lists** — Tasks organized into Day 1, Week 1, Week 2, and Month 1 phases
- **Progress tracking** — Real-time progress bar and per-phase completion stats
- **Dependency locking** — Tasks with prerequisites are locked until dependencies are done
- **Automated tasks** — Integration with the Backstage scaffolder for automated provisioning
- **Team view** — Managers can see onboarding progress for all team members
- **Template system** — Configurable onboarding templates per role and team
- **Catalog user assignment** — Search catalog users by name/email when assigning templates, with optional manual entity-ref fallback
- **Blocked task tracking** — Tasks can be marked as blocked with a reason

## How It Works

1. **Define onboarding templates** — Admins can create `OnboardingTemplate` entities as YAML in the Backstage catalog, or define fallback templates in `app-config.yaml`.
2. **Templates are matched to new joiners** — When a user entity appears in the catalog with a `spec.profile.role` that matches a template's `spec.role`, the backend auto-assigns that template the first time onboarding progress is requested for that user.
3. **Admins can also assign manually** — If you want to bypass automatic matching, call `POST /api/onboarding/templates/:name/assign/:userId` to assign a template directly.
4. **Team visibility is time-boxed** — `activeJoinerWindowDays` (default: `90`) controls which joiners are considered active and shown in the team view.
5. **Task progress is dependency-aware** — Progress is tracked per task, and any task with `dependsOn` stays locked until its prerequisite tasks are complete.
6. **Managers get aggregate team progress** — The team view rolls up onboarding progress for each manager's direct reports so leads can monitor completion across the team.

## Installation

### Frontend

```bash
# From your Backstage root directory
yarn --cwd packages/app add @estehsaan/backstage-plugin-onboarding
```

#### New Frontend System (Backstage ≥ 1.30)

Import the plugin from the `/alpha` subpath and register it in your app's `features` array in `packages/app/src/App.tsx`:

```tsx
import onboardingPlugin from '@estehsaan/backstage-plugin-onboarding/alpha';

export const app = createApp({
  features: [
    // ...other plugins
    onboardingPlugin,
  ],
});
```

The plugin automatically registers the `/onboarding` route and the sidebar nav item — no additional wiring required.

#### Legacy Frontend System (Backstage < 1.30)

Add the plugin page to your app routes in `packages/app/src/App.tsx`:

```tsx
import { OnboardingPage } from '@estehsaan/backstage-plugin-onboarding';

// In your routes:
<Route path="/onboarding" element={<OnboardingPage />} />;
```

Add a sidebar item in `packages/app/src/components/Root/Root.tsx`:

```tsx
import SchoolIcon from '@material-ui/icons/School';

// In your sidebar:
<SidebarItem icon={SchoolIcon} to="onboarding" text="Onboarding" />;
```

### Backend

```bash
# From your Backstage root directory
yarn --cwd packages/backend add @estehsaan/backstage-plugin-onboarding-backend
```

Add the backend plugin and catalog module to `packages/backend/src/index.ts`:

```ts
// Core backend plugin (REST API + database)
backend.add(import('@estehsaan/backstage-plugin-onboarding-backend'));

// Catalog module — registers the OnboardingTemplate entity kind
backend.add(import('@estehsaan/backstage-plugin-catalog-backend-module-onboarding'));
```

## Configuration

Add the following to your `app-config.yaml`:

```yaml
onboarding:
  templates:
    - type: catalog # Load from Backstage catalog entities
  defaults:
    activeJoinerWindowDays: 90 # How many days to consider someone "new"
    buddy:
      autoAssign: true # Auto-assign buddy from team members
```

## Onboarding Templates

Templates are defined as YAML files and registered in the Backstage catalog as `OnboardingTemplate` kind entities.

### Template Sources

1. **Catalog entities** (recommended) — Create YAML files with `kind: OnboardingTemplate` and register them in the catalog. This requires the catalog backend module so the custom entity kind is recognized.
2. **Config-based fallback** — Define templates under `onboarding.templates.defaults` in `app-config.yaml`. This is useful for simpler deployments that do not manage onboarding templates as catalog entities.

Example template:

```yaml
apiVersion: onboarding.backstage.io/v1
kind: OnboardingTemplate
metadata:
  name: backend-engineer-platform
  title: Backend Engineer — Platform Team
  description: Standard onboarding for backend engineers joining the platform team
spec:
  role: backend-engineer
  team: platform
  phases:
    - id: day1
      tasks:
        - id: setup-laptop
          title: Set up laptop & dev environment
          description: Run the bootstrap script and verify your local stack starts correctly.
          type: automated
          automationRef: setup-dev-environment
          assignee: self
          duePhase: day1
          link:
            label: Open setup guide
            url: https://docs.internal/setup

        - id: schedule-security-training
          title: Schedule security & compliance training
          description: Book your Week 1 security training slot during Day 1 onboarding.
          type: manual
          assignee: self
          duePhase: week1 # Deadline phase — can differ from parent phase if task is introduced early but due later

        - id: meet-buddy
          title: Meet your onboarding buddy
          description: 30-min intro call with your assigned buddy.
          type: manual
          assignee: buddy
          duePhase: day1

    - id: week1
      tasks:
        - id: security-training
          title: Complete security & compliance training
          description: Required before production access. Takes ~45 minutes.
          type: manual
          assignee: self
          duePhase: week1
          link:
            label: Start training
            url: https://training.internal/security

        - id: oncall-shadow
          title: Shadow an on-call shift
          description: Join the current on-call engineer for one shift.
          type: manual
          assignee: buddy
          dependsOn: [security-training]
          duePhase: week1

    - id: week2
      tasks:
        - id: first-pr
          title: Submit your first pull request
          description: Pick any "good first issue" from the team backlog.
          type: manual
          assignee: self
          duePhase: week2

    - id: month1
      tasks:
        - id: 30-day-checkin
          title: Complete 30-day check-in with manager
          description: Structured conversation covering experience, feedback, and 90-day goals.
          type: manual
          assignee: manager
          duePhase: month1
```

## Template Authoring Guide

Use this section as a quick reference when authoring onboarding templates.

### Template-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | string | Yes | Must be `onboarding.backstage.io/v1` |
| `kind` | string | Yes | Must be `OnboardingTemplate` |
| `metadata.name` | string | Yes | Unique identifier |
| `metadata.title` | string | Yes | Display name |
| `metadata.description` | string | No | Short description |
| `spec.role` | string | Yes | Role filter for auto-assignment |
| `spec.team` | string | No | Team filter for scoping |
| `spec.phases` | array | Yes | Ordered list of phase objects |

### Task-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique task identifier within template |
| `title` | string | Yes | Short display title |
| `description` | string | Yes | Detail shown in task panel |
| `type` | `manual` \| `automated` | Yes | How the task is completed |
| `assignee` | string | Yes | Who owns the task (`self`, `buddy`, `manager`, or entity ref) |
| `duePhase` | Phase | Yes | Deadline phase (may differ from parent phase) |
| `dependsOn` | string[] | No | Task IDs that must complete first |
| `automationRef` | string | No | Scaffolder template ref (required if type=automated) |
| `link` | object | No | External link (`{label, url}`) |
| `estimatedMinutes` | number | No | Estimated time to complete |
| `documentation` | string | No | Long-form docs for detail panel |
| `resources` | TaskResource[] | No | Supplementary learning materials |
| `recommendations` | string[] | No | Tips shown in detail panel |

## Task Types

| Type        | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `manual`    | Requires human action — click the checkbox when complete   |
| `automated` | Triggers a Backstage scaffolder action via `automationRef` |

### Automated Tasks

`automated` tasks trigger a **Backstage Scaffolder template** referenced by `automationRef`.

- The work runs remotely through the scaffolder backend.
- It can be used to provision repositories, cloud accounts, permissions, and other onboarding resources.
- It does **not** run anything locally on the new joiner's machine.
- Example: `automationRef: setup-dev-environment` triggers the scaffolder template with that ID.

### Assignee Types

- `self` — the new joiner themselves; they see this task in their personal checklist.
- `buddy` — another team member auto-assigned from the team group entity's members. Configure this with `onboarding.defaults.buddy.autoAssign: true`; if disabled, assign a buddy manually.
- `manager` — resolved from the `owner` relation on the team group entity in the catalog.
- Custom string (for example `user:default/jane`) — a fixed catalog user entity ref for explicit assignment.

## Task Statuses

| Status        | Description                         |
| ------------- | ----------------------------------- |
| `pending`     | Not yet started                     |
| `in-progress` | Automated task is currently running |
| `done`        | Completed                           |
| `blocked`     | Cannot proceed — includes a reason  |

## Permissions

| Action                   | Who can do it                          |
| ------------------------ | -------------------------------------- |
| Read/update own progress | Any authenticated user                 |
| View team stats          | Team leads (owners of the team entity) |
| Assign templates         | Backstage admins                       |

## Development

```bash
cd workspaces/onboarding
yarn install
yarn start
```

## License

Apache-2.0
