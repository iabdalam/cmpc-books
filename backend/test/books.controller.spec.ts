import { INestApplication, NotFoundException, StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BooksService } from '../src/books/books.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const id = '61c2434c-afd3-4ddb-9de2-210ca43b0869';
const dto = { title: 'Book', price: 12.5, available: true, authorId: id, publisherId: id, genreId: id };
const reference = { id, name: 'Name' };
const book = { id, title: 'Book', price: '12.50', available: true, imageUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  author: reference, publisher: reference, genre: reference };

describe('BooksController and protected master data', () => {
  let app: INestApplication;
  let token: string;
  const books = { findAll: jest.fn(), exportCsv: jest.fn(), uploadImage: jest.fn(), create: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id, email: 'demo@example.com' }) },
    author: { findMany: jest.fn() }, publisher: { findMany: jest.fn() }, genre: { findMany: jest.fn() },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(BooksService).useValue(books).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    token = await app.get(JwtService).signAsync({ sub: id });
  });

  beforeEach(() => {
    for (const mock of Object.values(books)) mock.mockReset().mockResolvedValue(book);
    books.remove.mockResolvedValue(undefined);
    for (const model of [prisma.author, prisma.publisher, prisma.genre]) {
      model.findMany.mockReset().mockResolvedValue([{ id, name: 'Alpha' }, { id, name: 'Zulu' }]);
    }
  });

  afterAll(async () => { await app.close(); });

  it.each([
    ['get', '/api/books'], ['get', '/api/books/export'], ['post', `/api/books/${id}/image`], ['post', '/api/books'], ['get', `/api/books/${id}`], ['patch', `/api/books/${id}`], ['delete', `/api/books/${id}`],
    ['get', '/api/authors'], ['get', '/api/publishers'], ['get', '/api/genres'],
  ] as const)('protects %s %s with JWT', async (method, path) => {
    await request(app.getHttpServer())[method](path).send(dto).expect(401);
    await request(app.getHttpServer())[method](path).auth('invalid', { type: 'bearer' }).send(dto).expect(401);
  });

  it('parses filters and pagination without changing false to true', async () => {
    await request(app.getHttpServer()).get('/api/books?page=2&limit=5&available=false&search=%20Book%20&sort=title:asc,price:desc')
      .auth(token, { type: 'bearer' }).expect(200);
    expect(books.findAll).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5, available: false, search: 'Book', sort: 'title:asc,price:desc' }));
  });
  it('serves export before the ID route and preserves download headers', async () => {
    books.exportCsv.mockResolvedValue(new StreamableFile(Buffer.from('"title"\r\n"Book"\r\n'), {
      type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="books.csv"',
    }));
    const response = await request(app.getHttpServer()).get('/api/books/export?available=true').auth(token, { type: 'bearer' }).expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe('attachment; filename="books.csv"');
    expect(response.text).toBe('"title"\r\n"Book"\r\n');
    expect(books.exportCsv).toHaveBeenCalledWith(expect.objectContaining({ available: true }));
    expect(books.findOne).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get('/api/books/export?page=1').auth(token, { type: 'bearer' }).expect(400);
  });
  it.each(['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=1000001', 'limit=0', 'limit=101', 'limit=1e1', 'available=0', 'available=TRUE', 'authorId=bad', 'publisherId=bad', 'genreId=bad', 'search=%20', 'unknown=value', 'sort=a&sort=b', 'available=true&available=false'])('rejects invalid listing query %s', async (query) => {
    await request(app.getHttpServer()).get('/api/books?' + query).auth(token, { type: 'bearer' }).expect(400);
    expect(books.findAll).not.toHaveBeenCalled();
  });

  it('creates a book with a trimmed title', async () => {
    await request(app.getHttpServer()).post('/api/books').auth(token, { type: 'bearer' })
      .send({ ...dto, title: '  Book  ' }).expect(201, book);
    expect(books.create).toHaveBeenCalledWith(expect.objectContaining(dto), id);
  });

  it('gets a book by ID', async () => {
    await request(app.getHttpServer()).get(`/api/books/${id}`).auth(token, { type: 'bearer' }).expect(200, book);
    expect(books.findOne).toHaveBeenCalledWith(id);
  });

  it('passes a partial update including null imageUrl', async () => {
    await request(app.getHttpServer()).patch(`/api/books/${id}`).auth(token, { type: 'bearer' })
      .send({ available: false, imageUrl: null }).expect(200, book);
    expect(books.update).toHaveBeenCalledWith(id, expect.objectContaining({ available: false, imageUrl: null }), id);
  });

  it('accepts an HTTP image URL without uploading anything', async () => {
    await request(app.getHttpServer()).post('/api/books').auth(token, { type: 'bearer' })
      .send({ ...dto, imageUrl: 'https://example.com/book.jpg' }).expect(201);
  });

  it('returns 204 without a body on delete', async () => {
    const response = await request(app.getHttpServer()).delete(`/api/books/${id}`).auth(token, { type: 'bearer' }).expect(204);
    expect(response.text).toBe('');
    expect(books.remove).toHaveBeenCalledWith(id, id);
  });

  it('preserves a service 404 response', async () => {
    books.findOne.mockRejectedValue(new NotFoundException('Book not found'));
    const response = await request(app.getHttpServer()).get(`/api/books/${id}`).auth(token, { type: 'bearer' }).expect(404);
    expect(response.body.message).toBe('Book not found');
  });

  it.each(['get', 'patch', 'delete'] as const)('validates path UUID for %s', async (method) => {
    await request(app.getHttpServer())[method]('/api/books/invalid').auth(token, { type: 'bearer' }).send(dto).expect(400);
  });

  it.each([
    { title: '' }, { title: '   ' }, { title: 123 }, { title: 'x'.repeat(256) }, { title: null },
    { price: -1 }, { price: 0.001 }, { price: '10' }, { price: 10000000000 }, { price: null },
    { available: 'false' }, { available: null }, { authorId: 'invalid' }, { publisherId: 'invalid' },
    { genreId: 'invalid' }, { authorId: null }, { publisherId: null }, { genreId: null },
    { imageUrl: 'javascript:alert(1)' }, { imageUrl: 42 }, { deletedAt: null },
  ])('rejects invalid fields for both create and update %#', async (invalid) => {
    await request(app.getHttpServer()).post('/api/books').auth(token, { type: 'bearer' }).send({ ...dto, ...invalid }).expect(400);
    await request(app.getHttpServer()).patch(`/api/books/${id}`).auth(token, { type: 'bearer' }).send(invalid).expect(400);
    expect(books.create).not.toHaveBeenCalled();
    expect(books.update).not.toHaveBeenCalled();
  });

  it('rejects missing required create fields', async () => {
    await request(app.getHttpServer()).post('/api/books').auth(token, { type: 'bearer' }).send({}).expect(400);
  });

  it.each([['authors', 'author'], ['publishers', 'publisher'], ['genres', 'genre']] as const)(
    'returns %s ordered by PostgreSQL', async (path, model) => {
      const response = await request(app.getHttpServer()).get(`/api/${path}`).auth(token, { type: 'bearer' }).expect(200);
      expect(response.body.map((item: { name: string }) => item.name)).toEqual(['Alpha', 'Zulu']);
      expect(prisma[model].findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
    },
  );

  it.each([['authors', 'author'], ['publishers', 'publisher'], ['genres', 'genre']] as const)(
    'hides persistence errors when loading %s', async (path, model) => {
      prisma[model].findMany.mockRejectedValue(new Error('private Prisma server details'));
      const response = await request(app.getHttpServer()).get(`/api/${path}`).auth(token, { type: 'bearer' }).expect(500);
      expect(response.text).not.toContain('Prisma');
      expect(response.text).not.toContain('private');
    },
  );

  it('does not implement master-data mutations', async () => {

    for (const path of ['authors', 'publishers', 'genres']) {
      await request(app.getHttpServer()).post(`/api/${path}`).auth(token, { type: 'bearer' }).send({ name: 'Test' }).expect(404);
    }
  });

  it('documents all seven protected operations and the response contract', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    for (const [path, methods] of Object.entries({ '/api/books': ['post', 'get'], '/api/books/export': ['get'], '/api/books/{id}/image': ['post'], '/api/books/{id}': ['get', 'patch', 'delete'],
      '/api/authors': ['get'], '/api/publishers': ['get'], '/api/genres': ['get'] })) {
      for (const method of methods) expect(body.paths[path][method].security).toEqual([{ bearer: [] }]);
    }

    expect(body.components.schemas.BookResponseDto.properties.price.type).toBe('string');
    expect(body.components.schemas.BookResponseDto.properties).not.toHaveProperty('deletedAt');
  });
});
