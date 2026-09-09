module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.integration.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testTimeout: 30000,
};
