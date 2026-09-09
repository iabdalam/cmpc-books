import { BadRequestException, INestApplication, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BookImagesService, MAX_IMAGE_BYTES, UPLOADS_DIRECTORY } from '../src/books/book-images.service';
import { setupApp } from '../src/setup-app';

const id = '61c2434c-afd3-4ddb-9de2-210ca43b0869';
const row = { id, title: 'Book', price: { toFixed: () => '1.00' }, available: true, imageUrl: null,
  createdAt: new Date(), updatedAt: new Date(), author: { id, name: 'Author' }, publisher: { id, name: 'Publisher' }, genre: { id, name: 'Genre' } };

describe('Local book image validation and HTTP lifecycle', () => {
  let app: INestApplication;
  let directory: string;
  let token: string;
  let png: Buffer;
  let images: BookImagesService;
  const db = { $transaction: jest.fn(), user: { findUnique: jest.fn() }, book: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    author: { findUnique: jest.fn() }, publisher: { findUnique: jest.fn() }, genre: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } };

  beforeAll(async () => {
    directory = await mkdtemp(resolve('image-test-'));
    png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#123456' } }).png().toBuffer();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db).overrideProvider(UPLOADS_DIRECTORY).useValue(directory).compile();
    app = module.createNestApplication(); setupApp(app); await app.init();
    token = await app.get(JwtService).signAsync({ sub: id }); images = app.get(BookImagesService);
  });
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation((fn) => fn(db)); db.user.findUnique.mockResolvedValue({ id, email: 'demo@example.com' });
    db.book.findUnique.mockResolvedValue(row); db.book.findFirst.mockResolvedValue({ id });
    db.book.update.mockImplementation(({ data }) => Promise.resolve({ ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) }));
    for (const model of [db.author, db.publisher, db.genre]) model.findUnique.mockResolvedValue({ id });
  });
  afterEach(async () => { for (const name of await readdir(directory)) await unlink(join(directory, name)); });
  afterAll(async () => { await app?.close(); if (directory) await rmdir(directory); });

  it.each(['png', 'jpeg', 'webp'] as const)('accepts and recodes a genuine %s image with a safe filename', async (format) => {
    const buffer = await sharp(png)[format]().toBuffer();
    const response = await request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' })
      .attach('file', buffer, { filename: '../../unsafe.' + format, contentType: 'image/' + format }).expect(200);
    expect(response.body.imageUrl).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({ userId: id, action: 'UPDATE', metadata: { fields: ['imageUrl'] } });
    const image = await request(app.getHttpServer()).get(response.body.imageUrl).expect(200).expect('Content-Type', 'image/webp');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    expect(image.headers['cache-control']).toBe('no-store');
    expect((await sharp(image.body as Buffer).metadata()).format).toBe('webp');
    db.book.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get(response.body.imageUrl).expect(404);
  });
  it('rejects unauthenticated upload before writing files', async () => {
    await request(app.getHttpServer()).post(`/api/books/${id}/image`).attach('file', png, 'image.png').expect(401);
    expect(await readdir(directory)).toEqual([]);
  });
  it.each([
    [Buffer.from('<svg></svg>'), 'image/svg+xml'],
    [Buffer.from('not an image'), 'image/png'],
    [Buffer.from(''), 'image/png'],
  ])('rejects invalid file content or MIME %#', async (buffer, mimetype) => {
    await request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' })
      .attach('file', buffer as Buffer, { filename: 'image.png', contentType: mimetype as string }).expect(400);
    expect(db.book.update).not.toHaveBeenCalled(); expect(await readdir(directory)).toEqual([]);
  });
  it('rejects mismatched declared MIME even for a genuine image', async () => {
    await expect(images.save({ buffer: png, size: png.length, mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects oversized uploads at the multipart boundary and service boundary', async () => {
    await request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' })
      .attach('file', Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image.png').expect(413);
    await expect(images.save({ buffer: png, size: MAX_IMAGE_BYTES + 1, mimetype: 'image/png' })).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
  it('rejects missing file, wrong field, extra fields and invalid UUID', async () => {
    const http = () => request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' });
    await http().expect(400);
    await http().attach('other', png, 'image.png').expect(400);
    await http().field('extra', 'value').attach('file', png, 'image.png').expect(400);
    await request(app.getHttpServer()).post('/api/books/invalid/image').auth(token, { type: 'bearer' }).attach('file', png, 'image.png').expect(400);
  });
  it('does not write an image for a deleted book', async () => {
    db.book.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' }).attach('file', png, 'image.png').expect(404);
    expect(await readdir(directory)).toEqual([]);
  });
  it('compensates filesystem writes if audit fails', async () => {
    db.auditLog.create.mockRejectedValue(new Error('sensitive database detail')); db.book.findFirst.mockResolvedValue(null);
    const response = await request(app.getHttpServer()).post(`/api/books/${id}/image`).auth(token, { type: 'bearer' }).attach('file', png, 'image.png').expect(500);
    expect(response.text).not.toContain('sensitive'); expect(await readdir(directory)).toEqual([]);
  });
  it('removes an unused previous image but preserves a referenced image', async () => {
    const url = await images.save({ buffer: png, size: png.length, mimetype: 'image/png' });
    await images.removeIfUnused(url); expect(await readdir(directory)).toHaveLength(1);
    db.book.findFirst.mockResolvedValue(null);
    await images.removeIfUnused(url); expect(await readdir(directory)).toHaveLength(0);
    await images.removeIfUnused(url);
    await images.removeIfUnused('/api/uploads/../../secret');
    await images.removeIfUnused('https://example.com/image');
  });
  it('rejects unsafe paths and missing files without revealing filesystem details', async () => {
    await expect(images.read('../secret')).rejects.toBeInstanceOf(NotFoundException);
    await expect(images.read(id + '.webp')).rejects.toBeInstanceOf(NotFoundException);
  });
});
