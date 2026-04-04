# @estehsaan/backstage-plugin-onboarding

## 0.2.0

### Minor Changes

- [#2](https://github.com/Estehsan/backstage-plugin-onboarding/pull/2) [`f23fa56`](https://github.com/Estehsan/backstage-plugin-onboarding/commit/f23fa56b2b66dc3298996b46527f94403df7117b) Thanks [@Estehsan](https://github.com/Estehsan)! - Export `OnboardingCatalogUser` from the package entrypoint and harden API report/CI validation flow used by the onboarding plugin workspace.

## 0.1.2

### Patch Changes

- Improve plugin reliability and documentation
  - Migrate frontend to new Backstage frontend system (createFrontendPlugin, blueprints)
  - Add EntityUserOnboardingCard entity card extension
  - Fix resolvePackagePath usage in OnboardingStore
  - Add full TSDoc API documentation for all public exports
  - Update copyright headers to 2026
  - Fix Yarn lockfile pinning for deterministic CI installs

- Updated dependencies []:
  - @estehsaan/backstage-plugin-onboarding-common@0.1.1
