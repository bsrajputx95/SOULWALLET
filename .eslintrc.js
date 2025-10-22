module.exports = {
  extends: ['expo'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // Allow ts-ignore comments (we're using them for mock tRPC)
    '@typescript-eslint/ban-ts-comment': 'off',
    // Don't require explicit return types
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // Allow any types for now
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow unused vars that start with underscore
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Allow require statements
    '@typescript-eslint/no-var-requires': 'off',
    // React Native specific
    'react-native/no-inline-styles': 'off',
    // General
    'no-console': 'off',
    'prefer-const': 'warn',
    'no-var': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
    'jest.setup.js',
    'jest.config.js',
    'scripts/',
    'global.d.ts',
  ],
};
