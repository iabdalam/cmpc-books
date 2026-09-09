module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
};
