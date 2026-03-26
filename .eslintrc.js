/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    '@backstage/eslint-plugin',
  ],
  rules: {
    'no-warning-comments': ['error', { terms: ['FIXME'], location: 'start' }],
  },
};
