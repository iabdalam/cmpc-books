import { isEmail } from 'class-validator';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

export function readSeedConfig(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Seed is only allowed with NODE_ENV=development');
  }
  const email = env.SEED_DEMO_EMAIL?.trim().toLowerCase();
  const password = env.SEED_DEMO_PASSWORD;
  if (!email || !isEmail(email)) throw new Error('SEED_DEMO_EMAIL must be a valid email');
  if (!password || password.trim().length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('SEED_DEMO_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes');
  }
  return { email, password };
}

export async function seedDevelopment(prisma: PrismaClient, config: ReturnType<typeof readSeedConfig>) {
  const passwordHash = await hash(config.password, 12);

  // Todo el conjunto inicial se confirma junto; repetir el seed conserva datos y contraseñas existentes.
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { email: config.email },
      create: { email: config.email, passwordHash },
      update: {},
    });
    for (const name of ['Isabel Allende', 'Gabriel García Márquez', 'Julio Cortázar']) {
      await tx.author.upsert({ where: { name }, create: { name }, update: {} });
    }
    for (const name of ['Sudamericana', 'Alfaguara']) {
      await tx.publisher.upsert({ where: { name }, create: { name }, update: {} });
    }
    for (const name of ['Novela', 'Cuento', 'Ensayo']) {
      await tx.genre.upsert({ where: { name }, create: { name }, update: {} });
    }
  });
}
