const { spawn } = require('node:child_process');

// Compose comparte las credenciales de PostgreSQL; la URL local del host no
// sirve dentro de la red Docker. Codificar evita fallos con caracteres especiales.
const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
  console.error('Missing PostgreSQL container configuration');
  process.exit(1);
}
process.env.DATABASE_URL = `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@postgres:5432/${encodeURIComponent(POSTGRES_DB)}?schema=public`;

const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', () => {
  console.error('Unable to start container command');
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGTERM' ? 0 : 1)));
