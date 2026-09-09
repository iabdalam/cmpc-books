export function validateEnvironment(config: Record<string, unknown>) {
  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return { ...config, PORT: port, DATABASE_URL: validateDatabaseUrl(config.DATABASE_URL) };
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
