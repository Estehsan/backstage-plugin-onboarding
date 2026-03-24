# backstage-plugins

A standalone monorepo for Backstage plugins published under the `@estehsan` npm scope, following the same workspace pattern as [`backstage/community-plugins`](https://github.com/backstage/community-plugins).

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@estehsan/backstage-plugin-onboarding`](./workspaces/onboarding/plugins/onboarding) | [![npm](https://img.shields.io/npm/v/@estehsan/backstage-plugin-onboarding)](https://www.npmjs.com/package/@estehsan/backstage-plugin-onboarding) | Frontend onboarding checklist plugin |
| [`@estehsan/backstage-plugin-onboarding-backend`](./workspaces/onboarding/plugins/onboarding-backend) | [![npm](https://img.shields.io/npm/v/@estehsan/backstage-plugin-onboarding-backend)](https://www.npmjs.com/package/@estehsan/backstage-plugin-onboarding-backend) | Backend for the onboarding plugin |
| [`@estehsan/backstage-plugin-onboarding-common`](./workspaces/onboarding/plugins/onboarding-common) | [![npm](https://img.shields.io/npm/v/@estehsan/backstage-plugin-onboarding-common)](https://www.npmjs.com/package/@estehsan/backstage-plugin-onboarding-common) | Shared types and permissions |

## Installation (for consumers)

```bash
# In your Backstage app
yarn --cwd packages/app add @estehsan/backstage-plugin-onboarding

# In your Backstage backend
yarn --cwd packages/backend add @estehsan/backstage-plugin-onboarding-backend
```

See the package readmes and `workspaces/onboarding/PUBLISHING.md` for full wiring and publishing instructions.

## Repository Structure

```
workspaces/
  onboarding/              # workspace root (independent yarn workspace)
    plugins/
      onboarding/          # @estehsan/backstage-plugin-onboarding
      onboarding-backend/  # @estehsan/backstage-plugin-onboarding-backend
      onboarding-common/   # @estehsan/backstage-plugin-onboarding-common
    app-config.yaml        # local dev config
    package.json
```

## Development

```bash
# Install all dependencies
yarn install

# Run the frontend plugin dev server
cd workspaces/onboarding/plugins/onboarding
yarn start

# Run tests
yarn test workspaces/onboarding
```

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

### Creating a changeset

```bash
# From the repo root
yarn changeset
# Select the packages you've changed, pick a bump type, write a summary
# Commit the generated .changeset/*.md file
```

### Publishing to npm

Releases are fully automated via GitHub Actions:

1. Merge a PR with a changeset into `main`.
2. The **Release** workflow opens (or updates) a "Version Packages" PR.
3. Merge that PR — packages are built and published to npm automatically.

To publish manually (first time / local):

```bash
npm login
yarn install
yarn build:all
yarn changeset publish
```

## Contributing

1. Fork this repository.
2. Create a feature branch.
3. Make your changes in the relevant workspace.
4. Add a changeset (`yarn changeset`).
5. Open a pull request against `main`.

## License

[Apache-2.0](./LICENSE)
# backstage-plugin-onboarding
