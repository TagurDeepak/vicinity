const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Transpile the workspace TS packages that are symlinked into node_modules.
  transformIgnorePatterns: ['/node_modules/(?!(?:@vicinity)/)'],
};

module.exports = createJestConfig(customConfig);
