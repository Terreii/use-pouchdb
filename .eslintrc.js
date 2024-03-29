module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jest/recommended',
  ],
  rules: {
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          '{}': false,
        },
      },
    ],
  },
}
