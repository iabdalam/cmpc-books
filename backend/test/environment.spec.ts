import { validateEnvironment } from '../src/config/environment';

describe('Environment configuration', () => {
  it('defaults to port 3000', () => {
    expect(validateEnvironment({}).PORT).toBe(3000);
  });

  it('parses the configured port', () => {
    expect(validateEnvironment({ PORT: '4000' }).PORT).toBe(4000);
  });

  it.each(['', 'abc', '1.5', '0', '-1', '65536'])(
    'rejects invalid port %s', (PORT) => {
      expect(() => validateEnvironment({ PORT })).toThrow('PORT must be an integer');
    },
  );
});
