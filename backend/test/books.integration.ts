import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '../src/generated/prisma/client';
import { validateDatabaseUrl } from '../src/config/environment';
import { setupApp } from '../src/setup-app';
import { readSeedConfig } from '../prisma/seed-data';
import { AuditService } from '../src/audit/audit.service';
import { BooksService } from '../src/books/books.service';
import { BookImagesService } from '../src/books/book-images.service';
import { UPLOADS_DIRECTORY } from '../src/books/book-images.service';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

describe('Books and master data with PostgreSQL', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    readSeedConfig(process.env);

    prisma = new PrismaService(
      new ConfigService({
        DATABASE_URL: validateDatabaseUrl(process.env.DATABASE_URL),
      }),
    );

    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma?.onModuleDestroy();
  });

  async function withApplication(
    run: (
      tx: Prisma.TransactionClient,
      app: INestApplication,
      token: string,
    ) => Promise<void>,
  ) {
    const marker = new Error('rollback-test');
    const directory = await mkdtemp(resolve('db-image-test-'));

    try {
      await prisma.$transaction(
        async (tx) => {
          // Se usa PostgreSQL real dentro de una transacción de prueba.
          // El Proxy evita que Nest intente ejecutar $disconnect()
          // sobre Prisma.TransactionClient al cerrar la aplicación.
          let savepoint = 0;
          const transactionalPrisma = new Proxy(tx, {
            get(target, property, receiver) {
              if (property === '$transaction') return async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => {
                const name = 'book_test_' + (++savepoint);
                await tx.$executeRawUnsafe('SAVEPOINT ' + name);
                try {
                  const result = await run(tx);
                  await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name);
                  return result;
                } catch (error) {
                  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name);
                  throw error;
                }
              };
              if (
                property === 'onModuleInit' ||
                property === 'onModuleDestroy'
              ) {
                return async () => undefined;
              }

              return Reflect.get(target, property, receiver);
            },
          });

          const module = await Test.createTestingModule({
            imports: [AppModule],
          })
            .overrideProvider(PrismaService)
            .useValue(transactionalPrisma)
            .overrideProvider(UPLOADS_DIRECTORY)
            .useValue(directory)
            .compile();

          const app = module.createNestApplication();

          try {
            setupApp(app);
            await app.init();

            const user = await tx.user.findUniqueOrThrow({
              where: {
                email: readSeedConfig(process.env).email,
              },
            });

            const token = await app
              .get(JwtService)
              .signAsync({ sub: user.id });

            await run(tx, app, token);
          } finally {
            await app.close();
          }

          throw marker;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== marker) {
        throw error;
      }
    } finally {
      for (const filename of await readdir(directory)) await unlink(join(directory, filename));
      await rmdir(directory);
    }
  }

  it('creates and updates real relations, then soft-deletes without physical removal', async () => {
    let createdId = '';

    await withApplication(async (tx, app, token) => {
      const suffix = randomUUID();

      const author = await tx.author.create({
        data: {
          name: `Author ${suffix}`,
        },
      });

      const publisher = await tx.publisher.create({
        data: {
          name: `Publisher ${suffix}`,
        },
      });

      const genre = await tx.genre.create({
        data: {
          name: `Genre ${suffix}`,
        },
      });

      const replacement = await tx.author.create({
        data: {
          name: `Replacement ${suffix}`,
        },
      });

      const body = {
        title: '  Integration book  ',
        price: 12.5,
        available: true,
        authorId: author.id,
        publisherId: publisher.id,
        genreId: genre.id,
      };

      const created = await request(app.getHttpServer())
        .post('/api/books')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(201);

      createdId = created.body.id;

      expect(created.body).toMatchObject({
        title: 'Integration book',
        price: '12.50',
        available: true,
        imageUrl: null,
        author: {
          id: author.id,
          name: author.name,
        },
        publisher: {
          id: publisher.id,
          name: publisher.name,
        },
        genre: {
          id: genre.id,
          name: genre.name,
        },
      });

      expect(Object.keys(created.body).sort()).toEqual(
        [
          'id',
          'title',
          'price',
          'available',
          'imageUrl',
          'createdAt',
          'updatedAt',
          'author',
          'publisher',
          'genre',
        ].sort(),
      );

      await request(app.getHttpServer())
        .get(`/api/books/${createdId}`)
        .auth(token, { type: 'bearer' })
        .expect(200, created.body);

      const updated = await request(app.getHttpServer())
        .patch(`/api/books/${createdId}`)
        .auth(token, { type: 'bearer' })
        .send({
          price: 0,
          available: false,
          authorId: replacement.id,
          imageUrl: 'https://example.com/book.jpg',
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        title: 'Integration book',
        price: '0.00',
        available: false,
        author: {
          id: replacement.id,
          name: replacement.name,
        },
        imageUrl: 'https://example.com/book.jpg',
      });

      const cleared = await request(app.getHttpServer())
        .patch(`/api/books/${createdId}`)
        .auth(token, { type: 'bearer' })
        .send({
          imageUrl: null,
        })
        .expect(200);

      expect(cleared.body.imageUrl).toBeNull();

      await request(app.getHttpServer())
        .patch(`/api/books/${createdId}`)
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(400);

      for (const field of ['authorId', 'publisherId', 'genreId']) {
        await request(app.getHttpServer())
          .post('/api/books')
          .auth(token, { type: 'bearer' })
          .send({
            ...body,
            [field]: randomUUID(),
          })
          .expect(400);

        await request(app.getHttpServer())
          .patch(`/api/books/${createdId}`)
          .auth(token, { type: 'bearer' })
          .send({
            [field]: randomUUID(),
          })
          .expect(400);
      }

      expect(
        await tx.book.count({
          where: {
            id: createdId,
          },
        }),
      ).toBe(1);

      await request(app.getHttpServer())
        .delete(`/api/books/${createdId}`)
        .auth(token, { type: 'bearer' })
        .expect(204);

      const stored = await tx.book.findUniqueOrThrow({
        where: {
          id: createdId,
        },
      });

      const logs = await tx.auditLog.findMany({ where: { entityId: createdId }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((log) => log.action).sort()).toEqual(['CREATE', 'DELETE', 'UPDATE', 'UPDATE']);
      const user = await tx.user.findUniqueOrThrow({ where: { email: readSeedConfig(process.env).email } });
      expect(logs.every((log) => log.userId === user.id && log.entity === 'Book')).toBe(true);
      expect(JSON.stringify(logs)).not.toContain('password');
      expect(stored.deletedAt).toBeInstanceOf(Date);
      expect(stored.authorId).toBe(replacement.id);

      for (const method of ['get', 'patch', 'delete'] as const) {
        const response = await request(app.getHttpServer())
          [method](`/api/books/${createdId}`)
          .auth(token, { type: 'bearer' })
          .send({
            title: 'Cannot restore',
          })
          .expect(404);

        expect(response.body.message).toBe('Book not found');

        await request(app.getHttpServer())
          [method](`/api/books/${randomUUID()}`)
          .auth(token, { type: 'bearer' })
          .send({
            title: 'Missing',
          })
          .expect(404);
      }

      expect(
        (
          await tx.book.findUniqueOrThrow({
            where: {
              id: createdId,
            },
          })
        ).deletedAt,
      ).toEqual(stored.deletedAt);
    });

    expect(
      await prisma.book.findUnique({
        where: {
          id: createdId,
        },
      }),
    ).toBeNull();
  });

  it('returns master data alphabetically using PostgreSQL, including existing seed records', async () => {
    await withApplication(async (tx, app, token) => {
      const suffix = randomUUID();

      const cases = [
        {
          path: 'authors',
          seed: 'Isabel Allende',
          first: await tx.author.create({
            data: {
              name: `Alpha ${suffix}`,
            },
          }),
          last: await tx.author.create({
            data: {
              name: `Zulu ${suffix}`,
            },
          }),
        },
        {
          path: 'publishers',
          seed: 'Alfaguara',
          first: await tx.publisher.create({
            data: {
              name: `Alpha ${suffix}`,
            },
          }),
          last: await tx.publisher.create({
            data: {
              name: `Zulu ${suffix}`,
            },
          }),
        },
        {
          path: 'genres',
          seed: 'Novela',
          first: await tx.genre.create({
            data: {
              name: `Alpha ${suffix}`,
            },
          }),
          last: await tx.genre.create({
            data: {
              name: `Zulu ${suffix}`,
            },
          }),
        },
      ];

      for (const item of cases) {
        const response = await request(app.getHttpServer())
          .get(`/api/${item.path}`)
          .auth(token, { type: 'bearer' })
          .expect(200);

        const data: { id: string; name: string }[] = response.body;

        expect(
          data.findIndex((row) => row.id === item.first.id),
        ).toBeLessThan(
          data.findIndex((row) => row.id === item.last.id),
        );

        expect(
          data.some((row) => row.name === item.seed),
        ).toBe(true);

        expect(Object.keys(data[0]).sort()).toEqual([
          'id',
          'name',
        ]);
      }
    });
  });

  it('filters, searches, paginates, sorts and exports active rows in PostgreSQL', async () => {
    await withApplication(async (tx, app, token) => {
      const suffix = randomUUID();
      const author = await tx.author.create({ data: { name: `Writer ${suffix}` } });
      const publisher = await tx.publisher.create({ data: { name: `Press ${suffix}` } });
      const genre = await tx.genre.create({ data: { name: `Category ${suffix}` } });
      const base = { authorId: author.id, publisherId: publisher.id, genreId: genre.id };
      const first = await tx.book.create({ data: { ...base, title: 'Alpha', price: 20, available: true } });
      const second = await tx.book.create({ data: { ...base, title: 'Alpha', price: 10, available: false } });
      const third = await tx.book.create({ data: { ...base, title: 'Zeta 100%_literal', price: 5, available: true } });
      await tx.book.create({ data: { ...base, title: 'Deleted', price: 0, deletedAt: new Date() } });
      const get = (query: Record<string, string | number | boolean>) => request(app.getHttpServer()).get('/api/books')
        .auth(token, { type: 'bearer' }).query({ genreId: genre.id, ...query });
      const page = await get({ sort: 'title:asc,price:desc', page: 1, limit: 2 }).expect(200);
      expect(page.body.data.map((book: { id: string }) => book.id)).toEqual([first.id, second.id]);
      expect(page.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
      const next = await get({ sort: 'title:asc,price:desc', page: 2, limit: 2 }).expect(200);
      expect(next.body.data.map((book: { id: string }) => book.id)).toEqual([third.id]);
      for (const search of ['alpha', author.name.toUpperCase(), publisher.name.toUpperCase(), '%_literal']) {
        const result = await get({ search }).expect(200);
        expect(result.body.meta.total).toBe(search === 'alpha' ? 2 : search === '%_literal' ? 1 : 3);
      }
      const filtered = await get({ authorId: author.id, publisherId: publisher.id, available: false }).expect(200);
      expect(filtered.body.data.map((book: { id: string }) => book.id)).toEqual([second.id]);
      await get({ sort: 'passwordHash:asc' }).expect(400);
      const csv = await request(app.getHttpServer()).get('/api/books/export').auth(token, { type: 'bearer' })
        .query({ genreId: genre.id, available: true }).expect(200);
      expect(csv.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
      expect(csv.headers['content-disposition']).toBe('attachment; filename="books.csv"');
      expect(csv.text).toContain(first.id); expect(csv.text).toContain(third.id);
      expect(csv.text).not.toContain(second.id); expect(csv.text).not.toContain('Deleted');
    });
  });

  it('rolls back a real PostgreSQL create when audit persistence fails', async () => {
    const author = await prisma.author.findFirstOrThrow();
    const publisher = await prisma.publisher.findFirstOrThrow();
    const genre = await prisma.genre.findFirstOrThrow();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: readSeedConfig(process.env).email } });
    const title = `Rollback ${randomUUID()}`;
    const audit = new AuditService();
    jest.spyOn(audit, 'recordBook').mockImplementation(async (tx, userId, action, entityId, fields) => {
      await tx.auditLog.create({ data: { userId, action, entityId, entity: 'Book', metadata: { fields } } });
      throw new Error('Simulated failure after audit insert');
    });
    const service = new BooksService(prisma, audit, {} as BookImagesService);
    await expect(service.create({ title, price: 1, available: true, authorId: author.id, publisherId: publisher.id, genreId: genre.id }, user.id)).rejects.toThrow();
    expect(await prisma.book.count({ where: { title } })).toBe(0);
    const entityId = (audit.recordBook as jest.Mock).mock.calls[0][3] as string;
    expect(await prisma.auditLog.count({ where: { entityId } })).toBe(0);
  });

  it('persists image URLs, audits replacements and hides images of deleted books', async () => {
    await withApplication(async (tx, app, token) => {
      const author = await tx.author.findFirstOrThrow();
      const publisher = await tx.publisher.findFirstOrThrow();
      const genre = await tx.genre.findFirstOrThrow();
      const created = await request(app.getHttpServer()).post('/api/books').auth(token, { type: 'bearer' })
        .send({ title: 'Image integration', price: 1, available: true, authorId: author.id, publisherId: publisher.id, genreId: genre.id }).expect(201);
      const id = created.body.id as string;
      const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#123456' } }).png().toBuffer();
      const upload = () => request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' }).attach('file', png, 'book.png');
      const first = await upload().expect(200);
      const second = await upload().expect(200);
      expect(first.body.imageUrl).not.toBe(second.body.imageUrl);
      expect((await tx.book.findUniqueOrThrow({ where: { id } })).imageUrl).toBe(second.body.imageUrl);
      await request(app.getHttpServer()).get(first.body.imageUrl).expect(404);
      await request(app.getHttpServer()).get(second.body.imageUrl).expect(200).expect('Content-Type', 'image/webp');
      await request(app.getHttpServer()).delete(`/api/books/${id}`).auth(token, { type: 'bearer' }).expect(204);
      await request(app.getHttpServer()).get(second.body.imageUrl).expect(404);
      expect(await tx.auditLog.count({ where: { entityId: id, action: 'UPDATE' } })).toBe(2);
    });
  });

  it.each(['update', 'delete'] as const)('rolls back %s and its audit record on PostgreSQL', async (operation) => {
    await withApplication(async (tx, app, token) => {
      const author = await tx.author.findFirstOrThrow();
      const publisher = await tx.publisher.findFirstOrThrow();
      const genre = await tx.genre.findFirstOrThrow();
      const book = await tx.book.create({ data: { title: 'Unchanged', price: 1, authorId: author.id, publisherId: publisher.id, genreId: genre.id } });
      const audit = app.get(AuditService);
      const original = audit.recordBook.bind(audit);
      jest.spyOn(audit, 'recordBook').mockImplementation(async (...args) => { await original(...args); throw new Error('Audit failure'); });
      const method = operation === 'update' ? 'patch' : 'delete';
      await request(app.getHttpServer())[method](`/api/books/${book.id}`).auth(token, { type: 'bearer' }).send({ title: 'Changed' }).expect(500);
      expect(await tx.book.findUniqueOrThrow({ where: { id: book.id } })).toEqual(book);
      expect(await tx.auditLog.count({ where: { entityId: book.id } })).toBe(0);
    });
  });
});
