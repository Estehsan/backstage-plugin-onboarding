// Publishing to npm requires an access token to be configured via the
// YARN_NPM_AUTH_TOKEN environment variable. When it is missing, we still run
// the release (changelog, version bump, git tag and GitHub release) instead of
// failing with EINVALIDNPMTOKEN.
const npmPublish = Boolean(process.env.YARN_NPM_AUTH_TOKEN);

/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    ['semantic-release-yarn', { npmPublish }],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'workspaces/onboarding/plugins/onboarding/package.json',
          'workspaces/onboarding/plugins/onboarding-backend/package.json',
          'workspaces/onboarding/plugins/onboarding-common/package.json',
          'workspaces/onboarding/plugins/catalog-backend-module-onboarding/package.json',
        ],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
