module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Tree shaking optimizations
      [
        'transform-imports',
        {
          '@expo/vector-icons': {
            transform: '@expo/vector-icons/${member}',
            preventFullImport: true,
          },
        },
      ],
      // Remove unused imports in production
      ...(process.env.NODE_ENV === 'production'
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
        : []),
      // IMPORTANT: Keep reanimated plugin last
      'react-native-reanimated/plugin',
    ],
    overrides: [
      {
        test: [
          './app/**/*',
          './components/**/*',
          './lib/**/*',
          './hooks/**/*',
          './utils/**/*',
          './src/**/*',
        ],
        plugins: [
          [
            'module-resolver',
            {
              root: ['./'],
              alias: {
                '@': './',
              },
              extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
            },
          ],
        ],
      },
    ],
  };
};
