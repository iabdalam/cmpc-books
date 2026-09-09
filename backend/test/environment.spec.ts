import { validateDatabaseUrl, validateEnvironment, validateJwtConfig } from '../src/config/environment';

const DATABASE_URL = 'postgresql://localhost/books_test';
const JWT_SECRET = process.env.JWT_SECRET;

describe('Environment configuration', () => {
  it('defaults to port 3000', () => {
    expect(validateEnvironment({ DATABASE_URL, JWT_SECRET }).PORT).toBe(3000);
  });

  it('parses the configured port', () => {
    expect(validateEnvironment({ DATABASE_URL, JWT_SECRET, PORT: '4000' }).PORT).toBe(4000);
  });

  it.each(['', 'abc', '1.5', '0', '-1', '65536'])(
    'rejects invalid port %s', (PORT) => {
      expect(() => validateEnvironment({ PORT })).toThrow('PORT must be an integer');
    },
  );
});

describe('JWT configuration', () => {
  it('defaults to 900 seconds', () => {
    expect(validateJwtConfig({ JWT_SECRET }).JWT_EXPIRES_IN).toBe(900);
  });
  it('parses a configured lifetime', () => {
    expect(validateJwtConfig({ JWT_SECRET, JWT_EXPIRES_IN: '3600' }).JWT_EXPIRES_IN).toBe(3600);
  });
  it.each([undefined, '', 'short', ' '.repeat(32)])('rejects missing or weak secrets', (secret) => {
    expect(() => validateJwtConfig({ JWT_SECRET: secret })).toThrow('JWT_SECRET is required');
  });
  it.each(['', 'abc', '15m', '0', '-1', '1.5', '86401'])('rejects invalid lifetime %s', (JWT_EXPIRES_IN) => {
    expect(() => validateJwtConfig({ JWT_SECRET, JWT_EXPIRES_IN })).toThrow('JWT_EXPIRES_IN must');
  });
});

describe('Database configuration', () => {
  it.each([DATABASE_URL, 'postgres://localhost/books_test?schema=public'])(
    'accepts PostgreSQL URL %s', (url) => expect(validateDatabaseUrl(url)).toBe(url),
  );

  it.each([undefined, '', 'invalid', 'https://localhost/books', 'postgresql://localhost/',
    'postgresql://localhost/books?schema=other', ` ${DATABASE_URL}`])(
    'rejects invalid database configuration %s', (url) => {
      expect(() => validateDatabaseUrl(url)).toThrow('DATABASE_URL must be a PostgreSQL URL');
    },
  );

  it('does not expose credentials in errors', () => {
    expect(() => validateDatabaseUrl('https://user:private-value@localhost/books'))
      .toThrow(/^DATABASE_URL must be a PostgreSQL URL with a host and database using the public schema$/);
  });
});
