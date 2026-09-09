import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { BookImagesService } from '../src/books/book-images.service';
import { BooksService } from '../src/books/books.service';

const id = '61c2434c-afd3-4ddb-9de2-210ca43b0869';
const dto = { title: 'Book', price: 12.5, available: true, authorId: id, publisherId: id, genreId: id };
const row = {
  id, title: 'Book', price: new Prisma.Decimal('12.50'), available: true, imageUrl: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
  author: { id, name: 'Author' }, publisher: { id, name: 'Publisher' }, genre: { id, name: 'Genre' },
};
const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('private database details', { code, clientVersion: '7.10.0' });

describe('BooksService', () => {
  const prisma = {
    $transaction: jest.fn(),
    auditLog: { create: jest.fn() },
    book: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    author: { findUnique: jest.fn() }, publisher: { findUnique: jest.fn() }, genre: { findUnique: jest.fn() },
  };
  let service: BooksService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.book.create.mockResolvedValue(row);
    prisma.book.findUnique.mockResolvedValue(row);
    prisma.book.update.mockResolvedValue(row);
    for (const model of [prisma.author, prisma.publisher, prisma.genre]) model.findUnique.mockResolvedValue({ id });
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    service = new BooksService(prisma as unknown as PrismaService, new AuditService(), {} as BookImagesService);
  });

  it('creates a book and returns decimal and date values suitable for JSON', async () => {
    const result = await service.create(dto, id);
    expect(result).toEqual({ ...row, price: '12.50', createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
    expect(prisma.book.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ...dto, imageUrl: undefined } }));
    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('authorId');
  });

  it.each(['author', 'publisher', 'genre'] as const)('refuses creation with missing %s', async (model) => {
    prisma[model].findUnique.mockResolvedValue(null);
    await expect(service.create(dto, id)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.book.create).not.toHaveBeenCalled();
  });

  it('gets an active book', async () => {
    expect((await service.findOne(id)).id).toBe(id);
    expect(prisma.book.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id, deletedAt: null } }));
  });

  it.each(['missing', 'soft-deleted'])('returns 404 for a %s book', async () => {
    prisma.book.findUnique.mockResolvedValue(null);
    await expect(service.findOne(id)).rejects.toThrow(new NotFoundException('Book not found'));
  });

  it('updates only supplied fields and retains active-book condition', async () => {
    prisma.book.update.mockResolvedValue({ ...row, title: 'Updated', available: false, imageUrl: null });
    const result = await service.update(id, { title: 'Updated', available: false, imageUrl: null }, id);
    expect(result.title).toBe('Updated');
    expect(result.available).toBe(false);
    expect(result.imageUrl).toBeNull();
    expect(prisma.book.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id, deletedAt: null }, data: expect.objectContaining({ title: 'Updated', price: undefined, imageUrl: null }),
    }));
  });

  it('validates all replacement relationships', async () => {
    await service.update(id, dto, id);
    for (const model of [prisma.author, prisma.publisher, prisma.genre]) {
      expect(model.findUnique).toHaveBeenCalledWith({ where: { id }, select: { id: true } });
    }
  });

  it.each(['author', 'publisher', 'genre'] as const)('refuses update with missing %s', async (model) => {
    prisma[model].findUnique.mockResolvedValue(null);
    await expect(service.update(id, dto, id)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.book.update).not.toHaveBeenCalled();
  });

  it('rejects empty updates', async () => {
    await expect(service.update(id, {}, id)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.book.update).not.toHaveBeenCalled();
  });

  it('never updates a soft-deleted book', async () => {
    prisma.book.findUnique.mockResolvedValue(null);
    await expect(service.update(id, { title: 'Updated' }, id)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.book.update).not.toHaveBeenCalled();
  });

  it('handles deletion between the read and the update', async () => {
    prisma.book.update.mockRejectedValue(prismaError('P2025'));
    await expect(service.update(id, { title: 'Updated' }, id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes through an atomic active-book update', async () => {
    await expect(service.remove(id, id)).resolves.toBeUndefined();
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id, deletedAt: null }, data: { deletedAt: expect.any(Date) }, select: { id: true },
    });
  });

  it.each(['missing', 'already deleted'])('returns the same 404 when deleting a %s book', async () => {
    prisma.book.update.mockRejectedValue(prismaError('P2025'));
    await expect(service.remove(id, id)).rejects.toThrow(new NotFoundException('Book not found'));
  });

  it('maps concurrent foreign-key failure to 400', async () => {
    prisma.book.create.mockRejectedValue(prismaError('P2003'));
    await expect(service.create(dto, id)).rejects.toThrow(new BadRequestException('Invalid author, publisher or genre reference'));
  });

  it.each([new Error('private details'), prismaError('P2024')])('hides unexpected persistence errors', async (error) => {
    prisma.book.create.mockRejectedValue(error);
    await expect(service.create(dto, id)).rejects.toThrow(new InternalServerErrorException('Unable to process book request'));
  });
});
