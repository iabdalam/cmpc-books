export function validateEnvironment(config: Record<string, unknown>) {
  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return { ...config, PORT: port, DATABASE_URL: validateDatabaseUrl(config.DATABASE_URL), ...validateJwtConfig(config) };
}

export function validateJwtConfig(config: Record<string, unknown>) {
  const secret = config.JWT_SECRET;
  if (typeof secret !== 'string' || secret.trim() !== secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET is required and must contain at least 32 bytes without surrounding whitespace');
  }
  const expiresIn = Number(config.JWT_EXPIRES_IN ?? 900);
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 86400) {
    throw new Error('JWT_EXPIRES_IN must be an integer between 1 and 86400 seconds');
  }
  return { JWT_SECRET: secret, JWT_EXPIRES_IN: expiresIn };
}

export function validateDatabaseUrl(value: unknown): string {
  try {
    if (typeof value !== 'string' || value.trim() !== value) throw new Error();
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
      throw new Error();
    }
    if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') {
      throw new Error();
    }
    return value;
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database using the public schema');
  }
}
