import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { validateDatabaseUrl } from '../src/config/environment';
import { readSeedConfig, seedDevelopment } from './seed-data';

async function main() {
  const config = readSeedConfig(process.env);
  const connectionString = validateDatabaseUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedDevelopment(prisma, config);
    console.log('Seed de desarrollo completado. Los registros existentes se conservaron.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error('Seed fallido. Revisa NODE_ENV, DATABASE_URL, SEED_DEMO_EMAIL, SEED_DEMO_PASSWORD y las migraciones.');
  process.exitCode = 1;
});
