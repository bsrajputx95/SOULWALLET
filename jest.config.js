const projects = [
  {
    displayName: 'property',
    testMatch: ['<rootDir>/__tests__/property/**/*.test.ts'],
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    setupFilesAfterEnv: ['<rootDir>/__tests__/property/setup.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
  },
  {
    displayName: 'integration',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
    },
    setupFilesAfterEnv: ['<rootDir>/__tests__/property/setup.ts'],
    testMatch: ['<rootDir>/__tests__/integration/**/*.test.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
  },
  {
    displayName: 'unit',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
    },
    setupFilesAfterEnv: ['<rootDir>/__tests__/property/setup.ts'],
    testMatch: [
      '<rootDir>/__tests__/unit/**/*.test.ts',
      '<rootDir>/__tests__/services/**/*.test.ts',
      '<rootDir>/__tests__/copyTrading/**/*.test.ts',
    ],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
  },
  {
    displayName: 'security',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
    },
    testMatch: ['<rootDir>/__tests__/security/**/*.test.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
  },
  {
    displayName: 'chaos',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
    },
    testMatch: ['<rootDir>/__tests__/chaos/**/*.test.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
  },
];

if (process.env.DETOX) {
  projects.push({
    displayName: 'e2e',
    testMatch: ['<rootDir>/__tests__/e2e/**/*.test.ts'],
    testEnvironment: 'detox/runners/jest',
    testTimeout: 120000,
    reporters: ['detox/runners/jest/reporter'],
    verbose: true,
  });
}

module.exports = {
  projects,
  collectCoverageFrom: [
    // Core runtime modules
    'src/lib/services/**/*.{ts,tsx}',
    'src/lib/middleware/**/*.{ts,tsx}',
    'src/lib/utils/**/*.{ts,tsx}',
    'src/lib/validations/**/*.{ts,tsx}',
    // API routers (critical for 90% threshold)
    'src/server/routers/**/*.{ts,tsx}',
    'src/server/context.ts',
    'src/server/router.ts',
    // Services
    'src/services/**/*.{ts,tsx}',
    // Exclude type definitions and test files
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
