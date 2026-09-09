import { readSeedConfig } from '../prisma/seed-data';

const env = {
  NODE_ENV: 'development',
  SEED_DEMO_EMAIL: '  DEMO@example.com ',
  SEED_DEMO_PASSWORD: 'test-only-password',
};

describe('Development seed configuration', () => {
  it('normalizes email', () => {
    expect(readSeedConfig(env).email).toBe('demo@example.com');
  });

  it.each(['production', 'test', undefined])('refuses environment %s', (NODE_ENV) => {
    expect(() => readSeedConfig({ ...env, NODE_ENV })).toThrow('only allowed');
  });

  it.each(['', 'invalid', undefined])('rejects invalid email %s', (SEED_DEMO_EMAIL) => {
    expect(() => readSeedConfig({ ...env, SEED_DEMO_EMAIL })).toThrow('valid email');
  });

  it.each(['', 'short', ' '.repeat(12), 'é'.repeat(37), undefined])(
    'rejects missing or unsafe passwords', (SEED_DEMO_PASSWORD) => {
      expect(() => readSeedConfig({ ...env, SEED_DEMO_PASSWORD })).toThrow('SEED_DEMO_PASSWORD');
    },
  );
});
