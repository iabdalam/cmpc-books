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

    try {
      await prisma.$transaction(
        async (tx) => {
          // Se usa PostgreSQL real dentro de una transacción de prueba.
          // El Proxy evita que Nest intente ejecutar $disconnect()
          // sobre Prisma.TransactionClient al cerrar la aplicación.
          const transactionalPrisma = new Proxy(tx, {
            get(target, property, receiver) {
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
});