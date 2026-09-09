import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { BooksService } from '../src/books/books.service';
import { BookImagesService } from '../src/books/book-images.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '../src/generated/prisma/client';
import { bookOrder, bookWhere } from '../src/books/book-query';
import { ListBooksDto } from '../src/books/dto/list-books.dto';
import { csvRow } from '../src/books/book-csv';

const id = '61c2434c-afd3-4ddb-9de2-210ca43b0869';
const dto = { title: 'Book', price: 12.5, available: false, authorId: id, publisherId: id, genreId: id };
const row = { id, title: 'Book', price: new Prisma.Decimal('12.50'), available: false, imageUrl: null,
  createdAt: new Date(), updatedAt: new Date(), author: { id, name: 'Author' }, publisher: { id, name: 'Publisher' }, genre: { id, name: 'Genre' } };

describe('Book queries, audit and export', () => {
  const db = { $transaction: jest.fn(), book: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    author: { findUnique: jest.fn() }, publisher: { findUnique: jest.fn() }, genre: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } };
  const images = { save: jest.fn(), removeIfUnused: jest.fn() };
  let service: BooksService;
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation((fn) => fn(db));
    db.book.findMany.mockResolvedValue([row]); db.book.count.mockResolvedValue(21);
    db.book.findUnique.mockResolvedValue(row); db.book.create.mockResolvedValue(row); db.book.update.mockResolvedValue(row);
    for (const model of [db.author, db.publisher, db.genre]) model.findUnique.mockResolvedValue({ id });
    service = new BooksService(db as unknown as PrismaService, new AuditService(), images as unknown as BookImagesService);
  });

  it('paginates and filters in PostgreSQL with a consistent count', async () => {
    const query = Object.assign(new ListBooksDto(), { page: 2, limit: 10, authorId: id, publisherId: id, genreId: id, available: false, sort: 'title:asc,price:desc' });
    const result = await service.findAll(query);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(result.data[0].price).toBe('12.50');
    expect(db.book.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, authorId: id, publisherId: id, genreId: id, available: false }, skip: 10, take: 10, orderBy: [{ title: 'asc' }, { price: 'desc' }, { id: 'asc' }] }));
    expect(db.book.count.mock.calls[0][0].where).toEqual(db.book.findMany.mock.calls[0][0].where);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
  });

  it('returns empty page metadata without inventing records', async () => {
    db.book.findMany.mockResolvedValue([]); db.book.count.mockResolvedValue(0);
    expect(await service.findAll(new ListBooksDto())).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('searches title, author and publisher case-insensitively and escapes LIKE wildcards', async () => {
    const where = bookWhere({ search: 'a%_\\' });
    expect(where.OR).toEqual([
      { title: { contains: 'a\\%\\_\\\\', mode: 'insensitive' } },
      { author: { name: { contains: 'a\\%\\_\\\\', mode: 'insensitive' } } },
      { publisher: { name: { contains: 'a\\%\\_\\\\', mode: 'insensitive' } } },
    ]);
    expect(where.deletedAt).toBeNull();
  });

  it.each(['', 'title', 'title:up', 'passwordHash:asc', 'author.name:asc', 'title:asc,title:desc', 'price:asc:desc', 'title:asc,', '__proto__:asc'])('rejects invalid sort %s before querying', async (sort) => {
    await expect(service.findAll(Object.assign(new ListBooksDto(), { sort }))).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('allows each public sort field and preserves an explicit ID direction', () => {
    expect(bookOrder('title:asc,price:desc,available:asc,createdAt:desc,updatedAt:asc,id:desc')).toHaveLength(6);
    expect(bookOrder('id:desc')).toEqual([{ id: 'desc' }]);
  });

  it.each(['CREATE', 'UPDATE', 'DELETE'] as const)('audits %s with authenticated user inside the mutation transaction', async (action) => {
    if (action === 'CREATE') await service.create(dto, id);
    if (action === 'UPDATE') await service.update(id, { title: 'Changed', price: undefined }, id);
    if (action === 'DELETE') await service.remove(id, id);
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: { userId: id, action, entity: 'Book', entityId: id, metadata: { fields: action === 'CREATE' ? Object.keys(dto) : action === 'UPDATE' ? ['title'] : ['deletedAt'] } } });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('Changed');
  });
  it.each(['CREATE', 'UPDATE', 'DELETE'] as const)('propagates audit failure out of the %s transaction so Prisma rolls it back', async (action) => {
    db.auditLog.create.mockRejectedValue(new Error('private audit error'));
    const operation = action === 'CREATE' ? service.create(dto, id) : action === 'UPDATE' ? service.update(id, dto, id) : service.remove(id, id);
    await expect(operation).rejects.toThrow('Unable to process book request');
    await expect(db.$transaction.mock.results[0].value).rejects.toThrow('private audit error');
  });
  it('reports serialization conflicts as retryable HTTP 409', async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('details', { code: 'P2034', clientVersion: '7' }));
    await expect(service.create(dto, id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('exports UTF-8 CSV with filters, quoted content and safe spreadsheet cells', async () => {
    db.book.findMany.mockResolvedValue([{ ...row, title: '=SUM(1,2)\r\n"hello"', imageUrl: 'https://example.com/image' }]);
    const file = await service.exportCsv({ available: false, search: 'Book' });
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf8');
    expect(text.startsWith('\uFEFF"id","title"')).toBe(true);
    expect(text).toContain('"\'=SUM(1,2)\r\n""hello"""');
    expect(text).toContain('"12.50","false","https://example.com/image"');
    expect(file.getHeaders()).toMatchObject({ type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="books.csv"' });
    expect(db.book.findMany.mock.calls[0][0].where).toMatchObject({ deletedAt: null, available: false, OR: expect.any(Array) });
  });
  it('exports a header for empty results', async () => {
    db.book.findMany.mockResolvedValue([]);
    const file = await service.exportCsv({});
    let output = ''; for await (const chunk of file.getStream()) output += chunk;
    expect(output.split('\r\n')).toHaveLength(2);
  });
  it('streams multiple bounded batches using a stable cursor', async () => {
    db.book.findMany.mockResolvedValueOnce(Array.from({ length: 500 }, () => row)).mockResolvedValueOnce([row]);
    const file = await service.exportCsv({});
    let count = 0; for await (const _chunk of file.getStream()) count++;
    expect(count).toBe(502);
    expect(db.book.findMany.mock.calls[1][0]).toMatchObject({ where: { id: { gt: id }, deletedAt: null }, take: 500 });
  });
  it('aborts an interrupted export without leaking the database error', async () => {
    db.book.findMany.mockResolvedValueOnce(Array.from({ length: 500 }, () => row)).mockRejectedValueOnce(new Error('secret database error'));
    const file = await service.exportCsv({});
    await expect((async () => { for await (const _chunk of file.getStream()) { /* Consume la descarga para provocar el fallo del segundo lote. */ } })()).rejects.toThrow();
    const response = { destroyed: false, headersSent: true, statusCode: 200, send: jest.fn(), end: jest.fn(), destroy: jest.fn(), setHeader: jest.fn() };
    file.errorHandler(new Error('secret'), response);
    expect(response.destroy).toHaveBeenCalled(); expect(response.send).not.toHaveBeenCalled();
    response.headersSent = false;
    file.errorHandler(new Error('secret'), response);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.send.mock.calls[0][0])).toEqual({ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' });
    response.destroyed = true; response.send.mockClear();
    file.errorHandler(new Error('secret'), response); expect(response.send).not.toHaveBeenCalled();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    file.errorLogger(new Error('secret')); expect(log).toHaveBeenCalledWith('CSV export interrupted'); log.mockRestore();
  });
  it.each(['=1', '+1', '-1', '@SUM(A1)', '\tformula', '\nformula', '  =1'])('neutralizes spreadsheet formula %s', (value) => {
    expect(csvRow([value])).toBe(`"'${value}"\r\n`);
  });

  it('replaces an image and compensates unused previous storage', async () => {
    db.book.findUnique.mockResolvedValue({ ...row, imageUrl: '/api/uploads/previous.webp' });
    images.save.mockResolvedValue('/api/uploads/new.webp');
    await service.uploadImage(id, undefined, id);
    expect(db.book.update.mock.calls[0][0].data.imageUrl).toBe('/api/uploads/new.webp');
    expect(images.removeIfUnused).toHaveBeenCalledWith('/api/uploads/previous.webp');
    expect(db.auditLog.create.mock.calls[0][0].data.metadata.fields).toEqual(['imageUrl']);
  });
  it('removes the new file when the audited update fails', async () => {
    images.save.mockResolvedValue('/api/uploads/new.webp'); db.auditLog.create.mockRejectedValue(new Error('failure'));
    await expect(service.uploadImage(id, undefined, id)).rejects.toThrow();
    expect(images.removeIfUnused).toHaveBeenCalledWith('/api/uploads/new.webp');
  });
});
