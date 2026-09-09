import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException, StreamableFile } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookImagesService, UploadedBookImage } from './book-images.service';
import { ListBooksDto } from './dto/list-books.dto';
import { BookFiltersDto } from './dto/book-filters.dto';
import { bookWhere, bookOrder } from './book-query';
import { Readable } from 'node:stream';
import { ServerResponse } from 'node:http';
import { csvRow } from './book-csv';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookResponseDto } from './dto/book-response.dto';

const bookSelect = {
  id: true, title: true, price: true, available: true, imageUrl: true,
  createdAt: true, updatedAt: true,
  author: { select: { id: true, name: true } },
  publisher: { select: { id: true, name: true } },
  genre: { select: { id: true, name: true } },
} satisfies Prisma.BookSelect;

type BookResult = Prisma.BookGetPayload<{ select: typeof bookSelect }>;

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly images: BookImagesService) {}

  async create(dto: CreateBookDto, userId: string): Promise<BookResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.validateReferences(dto, tx);
        const book = await tx.book.create({
          data: {
            title: dto.title, price: dto.price, available: dto.available, imageUrl: dto.imageUrl,
            authorId: dto.authorId, publisherId: dto.publisherId, genreId: dto.genreId,
          },
          select: bookSelect,
        });
        await this.audit.recordBook(tx, userId, 'CREATE', book.id, Object.keys(dto));
        return this.toResponse(book);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { this.handleError(error); }
  }

  async findOne(id: string): Promise<BookResponseDto> {
    try {
      const book = await this.prisma.book.findUnique({ where: { id, deletedAt: null }, select: bookSelect });
      if (!book) throw new NotFoundException('Book not found');
      return this.toResponse(book);
    } catch (error) { this.handleError(error); }
  }

  async update(id: string, dto: UpdateBookDto, userId: string): Promise<BookResponseDto> {
    try {
      let previousImage: string | null = null;
      const result = await this.prisma.$transaction(async (tx) => {
        const current = await tx.book.findUnique({ where: { id, deletedAt: null }, select: bookSelect });
        if (!current) throw new NotFoundException('Book not found');
        previousImage = current.imageUrl;
        if (Object.values(dto).every((value) => value === undefined)) {
          throw new BadRequestException('At least one field must be provided');
        }
        await this.validateReferences({
          authorId: dto.authorId ?? current.author.id,
          publisherId: dto.publisherId ?? current.publisher.id,
          genreId: dto.genreId ?? current.genre.id,
        }, tx);
        // La condición se repite en la escritura para cubrir una eliminación concurrente.
        const book = await tx.book.update({
          where: { id, deletedAt: null },
          data: {
            title: dto.title, price: dto.price, available: dto.available, imageUrl: dto.imageUrl,
            authorId: dto.authorId, publisherId: dto.publisherId, genreId: dto.genreId,
          },
          select: bookSelect,
        });
        await this.audit.recordBook(tx, userId, 'UPDATE', id, Object.keys(dto).filter((key) => dto[key as keyof UpdateBookDto] !== undefined));
        return this.toResponse(book);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (previousImage && dto.imageUrl !== undefined && dto.imageUrl !== previousImage) {
        await this.images.removeIfUnused(previousImage);
      }
      return result;
    } catch (error) { this.handleError(error); }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.book.update({
          where: { id, deletedAt: null }, data: { deletedAt: new Date() }, select: { id: true },
        });
        await this.audit.recordBook(tx, userId, 'DELETE', id, ['deletedAt']);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { this.handleError(error); }
  }

  async findAll(query: ListBooksDto) {
    const where = bookWhere(query);
    const orderBy = bookOrder(query.sort);
    const { page, limit } = query;
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.book.count({ where });
      const rows = await tx.book.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, select: bookSelect });
      return { data: rows.map((row) => this.toResponse(row)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async exportCsv(query: BookFiltersDto) {
    const where = bookWhere(query);
    const fetch = (cursor?: string) => this.prisma.book.findMany({
      where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' }, take: 500, select: bookSelect,
    });
    const first = await fetch();
    const toResponse = (row: BookResult) => this.toResponse(row);
    async function* rows() {
      yield '\uFEFF' + csvRow(['id', 'title', 'author', 'publisher', 'genre', 'price', 'available', 'imageUrl', 'createdAt', 'updatedAt']);
      let batch = first;
      while (batch.length) {
        for (const item of batch) {
          const book = toResponse(item);
          yield csvRow([book.id, book.title, book.author.name, book.publisher.name, book.genre.name, book.price, String(book.available), book.imageUrl ?? '', book.createdAt, book.updatedAt]);
        }
        if (batch.length < 500) break;
        batch = await fetch(batch[batch.length - 1].id);
      }
    }
    const file = new StreamableFile(Readable.from(rows()), { type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="books.csv"' });
    file.setErrorHandler((_error, response) => {
      if (response.destroyed) return;
      if (response.headersSent) {
        // Una descarga interrumpida no debe parecer un CSV completo.
        (response as unknown as ServerResponse).destroy();
      } else {
        response.statusCode = 500;
        (response as unknown as ServerResponse).setHeader('Content-Type', 'application/json; charset=utf-8');
        response.send(JSON.stringify({ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }));
      }
    });
    file.setErrorLogger(() => this.logger.error('CSV export interrupted'));
    return file;
  }

  async uploadImage(id: string, file: UploadedBookImage | undefined, userId: string) {
    await this.findOne(id);
    const imageUrl = await this.images.save(file);
    let result: BookResponseDto;
    try { result = await this.update(id, { imageUrl }, userId); }
    catch (error) { await this.images.removeIfUnused(imageUrl); throw error; }
    return result;
  }

  private async validateReferences(ids: Pick<CreateBookDto, 'authorId' | 'publisherId' | 'genreId'>, tx: Prisma.TransactionClient) {
    const author = await tx.author.findUnique({ where: { id: ids.authorId }, select: { id: true } });
    if (!author) throw new BadRequestException('Author not found');
    const publisher = await tx.publisher.findUnique({ where: { id: ids.publisherId }, select: { id: true } });
    if (!publisher) throw new BadRequestException('Publisher not found');
    const genre = await tx.genre.findUnique({ where: { id: ids.genreId }, select: { id: true } });
    if (!genre) throw new BadRequestException('Genre not found');
  }

  private toResponse(book: BookResult): BookResponseDto {
    return { ...book, price: book.price.toFixed(2), createdAt: book.createdAt.toISOString(), updatedAt: book.updatedAt.toISOString() };
  }

  private handleError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') throw new ConflictException('Concurrent change; retry the request');
      if (error.code === 'P2025') throw new NotFoundException('Book not found');
      // Una referencia puede desaparecer después de la validación; la FK sigue protegiendo la escritura.
      if (error.code === 'P2003') throw new BadRequestException('Invalid author, publisher or genre reference');
    }
    throw new InternalServerErrorException('Unable to process book request');
  }
}
