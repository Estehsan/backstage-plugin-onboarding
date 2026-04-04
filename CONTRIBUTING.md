# Contributing

Thank you for contributing! This document explains the conventions used in this repository.

## Table of Contents

- [Commit Message Format](#commit-message-format)
- [Branch Naming](#branch-naming)
- [Automated Releases](#automated-releases)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Developer Certificate of Origin](#developer-certificate-of-origin)
- [GitHub Actions & NPM_TOKEN](#github-actions--npm_token)
- [Local Development](#local-development)

---

## Commit Message Format

This repo follows the [Conventional Commits](https://www.conventionalcommits.org/) specification, consistent with the Backstage community.

```
<type>(<scope>): <short description>
```

### Types

| Type       | When to use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | A new feature                               |
| `fix`      | A bug fix                                   |
| `chore`    | Maintenance, dependency updates, tooling    |
| `docs`     | Documentation only changes                  |
| `refactor` | Code restructuring without behaviour change |
| `test`     | Adding or improving tests                   |
| `ci`       | GitHub Actions / CI configuration changes   |
| `perf`     | Performance improvements                    |
| `build`    | Build system changes                        |

### Scope

Use the plugin or package name: `onboarding`, `onboarding-backend`, `onboarding-common`.

### Examples

```
feat(onboarding): add team assignment view
fix(onboarding-backend): handle null user in progress endpoint
chore: update @backstage dependencies to 1.35.0
docs(onboarding): add installation guide to README
test(onboarding-backend): add router integration tests
ci: add yarn caching to release workflow
```

---

## Branch Naming

Use `<type>/<short-description>` in kebab-case:

```
feat/add-team-view
fix/handle-missing-user
chore/update-backstage-deps
docs/improve-readme
ci/add-caching
```

---

## Automated Releases

This repo uses **[semantic-release](https://semantic-release.gitbook.io/)** — no manual versioning or changeset files are needed.

**How it works:**

| Commit type                           | Release triggered         |
| ------------------------------------- | ------------------------- |
| `feat:`                               | Minor (`1.0.0` → `1.1.0`) |
| `fix:`                                | Patch (`1.0.0` → `1.0.1`) |
| `feat!:` or `BREAKING CHANGE:` footer | Major (`1.0.0` → `2.0.0`) |
| `chore:`, `docs:`, `ci:`, `test:`     | No release                |

Every merge to `main` triggers the `Release` workflow which:

1. Analyzes commits since the last release
2. Publishes all three packages to npm at the new version
3. Auto-generates `CHANGELOG.md` and commits it back
4. Creates a GitHub Release with release notes

**One-time setup** (repo owner only):

1. Create an npm **granular access token**:
   - Go to [npmjs.com → Access Tokens](https://www.npmjs.com/settings/~/tokens)
   - Click **Generate New Token → Granular Access Token**
   - Set **Packages and scopes**: Read and write, scoped to `@estehsaan`
   - Enable **"Bypass 2FA for writes"** (required for CI automation)
   - Copy the token

2. Add it to GitHub:
   - Go to **GitHub repo → Settings → Secrets and variables → Actions**
   - Click **New repository secret**, name it `NPM_TOKEN`, paste the token

3. Bootstrap the initial tag (one time only, after merging the semantic-release setup PR):
   ```bash
   git tag v1.0.0 <sha-of-1.0.0-commit>
   git push origin v1.0.0
   ```
   This tells semantic-release where versioning starts from.

---

- **PR title** must follow the same Conventional Commits format as commit messages.
- **Squash merge** is the default strategy — your commits will be squashed into one.
- Fill in the PR template fully.
- Keep PRs focused: one feature or fix per PR.
- For UI changes, attach before/after screenshots.

---

## Developer Certificate of Origin

All commits must be signed off to certify you wrote the change and have the right to contribute it:

```bash
git commit -s -m "feat(onboarding): add team view"
```

This adds a `Signed-off-by: Your Name <your@email.com>` line to the commit. See [developercertificate.org](https://developercertificate.org/) for the full text.

---

## GitHub Actions & NPM_TOKEN

See the [Automated Releases](#automated-releases) section above for setup instructions.

---

## Local Development

```bash
# Install all dependencies
yarn install

# Type check all packages
yarn tsc

# Build all packages
yarn build:all

# Lint all packages
yarn lint

# Run tests
yarn test

# Start the frontend plugin dev server
cd workspaces/onboarding/plugins/onboarding
yarn start
```
