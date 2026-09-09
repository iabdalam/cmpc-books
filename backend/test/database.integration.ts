import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { validateDatabaseUrl } from '../src/config/environment';
import { readSeedConfig, seedDevelopment } from '../prisma/seed-data';

function createMaster(tx: Prisma.TransactionClient, model: 'author' | 'publisher' | 'genre', name: string) {
  switch (model) {
    case 'author': return tx.author.create({ data: { name } });
    case 'publisher': return tx.publisher.create({ data: { name } });
    case 'genre': return tx.genre.create({ data: { name } });
  }
}

describe('PostgreSQL persistence', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'development') throw new Error('Database tests require NODE_ENV=development');
    prisma = new PrismaService(new ConfigService({
      DATABASE_URL: validateDatabaseUrl(process.env.DATABASE_URL),
    }));
    await prisma.onModuleInit();
  });

  afterAll(async () => { await prisma?.onModuleDestroy(); });

  // Las filas de prueba se revierten incluso si una aserción falla, sin borrar datos existentes.
  async function rollback(run: (tx: Prisma.TransactionClient) => Promise<void>) {
    const marker = new Error('rollback-test');
    try {
      await prisma.$transaction(async (tx) => { await run(tx); throw marker; });
    } catch (error) {
      if (error !== marker) throw error;
    }
  }

  it('seeds twice without duplicates or password changes and stores a valid hash', async () => {
    const config = readSeedConfig(process.env);
    await seedDevelopment(prisma, config);
    const first = await prisma.user.findUniqueOrThrow({ where: { email: config.email } });
    const counts = await Promise.all([prisma.user.count(), prisma.author.count(), prisma.publisher.count(), prisma.genre.count()]);
    await seedDevelopment(prisma, config);
    const second = await prisma.user.findUniqueOrThrow({ where: { email: config.email } });
    expect(second).toEqual(first);
    expect(await compare(config.password, second.passwordHash)).toBe(true);
    expect(await Promise.all([prisma.user.count(), prisma.author.count(), prisma.publisher.count(), prisma.genre.count()])).toEqual(counts);
  });

  it('enforces case-insensitive email uniqueness', async () => {
    await expect(rollback(async (tx) => {
      const email = `${randomUUID()}@example.com`;
      await tx.user.create({ data: { email, passwordHash: 'test-fixture-hash' } });
      await tx.user.create({ data: { email: email.toUpperCase(), passwordHash: 'test-fixture-hash' } });
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it.each(['author', 'publisher', 'genre'] as const)('enforces case-insensitive %s names', async (model) => {
    await expect(rollback(async (tx) => {
      const name = `Test ${randomUUID()}`;
      await createMaster(tx, model, name);
      await createMaster(tx, model, name.toUpperCase());
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it.each(['author', 'publisher', 'genre'] as const)('rejects unnormalized %s names', async (model) => {
    await expect(rollback(async (tx) => {
      await createMaster(tx, model, '  Test  Name ');
    })).rejects.toThrow();
  });

  it('persists book relationships, decimal price, timestamps and optional fields', async () => {
    await rollback(async (tx) => {
      const suffix = randomUUID();
      const book = await tx.book.create({
        data: {
          title: 'Model validation', price: new Prisma.Decimal('123.45'),
          author: { create: { name: `Author ${suffix}` } },
          publisher: { create: { name: `Publisher ${suffix}` } },
          genre: { create: { name: `Genre ${suffix}` } },
        },
        include: { author: true, publisher: true, genre: true },
      });
      expect(book.price.toFixed(2)).toBe('123.45');
      expect(book.available).toBe(true);
      expect(book.imageUrl).toBeNull();
      expect(book.deletedAt).toBeNull();
      expect(book.author.id).toBe(book.authorId);
      expect(book.publisher.id).toBe(book.publisherId);
      expect(book.genre.id).toBe(book.genreId);
      expect(book.createdAt).toBeInstanceOf(Date);
      const deletedAt = new Date();
      const updated = await tx.book.update({ where: { id: book.id }, data: { deletedAt } });
      expect(updated.deletedAt).toEqual(deletedAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(book.updatedAt.getTime());
      expect(await tx.book.count({ where: { id: book.id, deletedAt: null } })).toBe(0);
      expect(await tx.book.count({ where: { id: book.id } })).toBe(1);
    });
  });

  it('rejects missing foreign keys', async () => {
    await expect(rollback(async (tx) => {
      await tx.book.create({ data: {
        title: 'Invalid references', price: '10.00',
        authorId: randomUUID(), publisherId: randomUUID(), genreId: randomUUID(),
      } });
    })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects negative prices', async () => {
    await expect(rollback(async (tx) => {
      const suffix = randomUUID();
      await tx.book.create({ data: {
        title: 'Invalid price', price: '-0.01',
        author: { create: { name: `Author ${suffix}` } },
        publisher: { create: { name: `Publisher ${suffix}` } },
        genre: { create: { name: `Genre ${suffix}` } },
      } });
    })).rejects.toThrow();
  });

  it('stores audit metadata with an optional user relation', async () => {
    await rollback(async (tx) => {
      const user = await tx.user.create({ data: {
        email: `${randomUUID()}@example.com`, passwordHash: 'test-fixture-hash',
      } });
      const data = { action: 'TEST', entity: 'Book', entityId: randomUUID(), metadata: { source: 'test' } };
      const linked = await tx.auditLog.create({ data: { ...data, userId: user.id }, include: { user: true } });
      const unlinked = await tx.auditLog.create({ data });
      expect(linked.user?.id).toBe(user.id);
      expect(linked.metadata).toEqual({ source: 'test' });
      expect(unlinked.userId).toBeNull();
    });
  });
});
