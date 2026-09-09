import { BadRequestException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookDto): Promise<BookResponseDto> {
    try {
      await this.validateReferences(dto);
      const book = await this.prisma.book.create({
        data: {
          title: dto.title, price: dto.price, available: dto.available, imageUrl: dto.imageUrl,
          authorId: dto.authorId, publisherId: dto.publisherId, genreId: dto.genreId,
        },
        select: bookSelect,
      });
      return this.toResponse(book);
    } catch (error) { this.handleError(error); }
  }

  async findOne(id: string): Promise<BookResponseDto> {
    try {
      const book = await this.prisma.book.findUnique({ where: { id, deletedAt: null }, select: bookSelect });
      if (!book) throw new NotFoundException('Book not found');
      return this.toResponse(book);
    } catch (error) { this.handleError(error); }
  }

  async update(id: string, dto: UpdateBookDto): Promise<BookResponseDto> {
    try {
      const current = await this.findOne(id);
      if (Object.values(dto).every((value) => value === undefined)) {
        throw new BadRequestException('At least one field must be provided');
      }
      await this.validateReferences({
        authorId: dto.authorId ?? current.author.id,
        publisherId: dto.publisherId ?? current.publisher.id,
        genreId: dto.genreId ?? current.genre.id,
      });
      // La condición se repite en la escritura para cubrir una eliminación concurrente.
      const book = await this.prisma.book.update({
        where: { id, deletedAt: null },
        data: {
          title: dto.title, price: dto.price, available: dto.available, imageUrl: dto.imageUrl,
          authorId: dto.authorId, publisherId: dto.publisherId, genreId: dto.genreId,
        },
        select: bookSelect,
      });
      return this.toResponse(book);
    } catch (error) { this.handleError(error); }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.book.update({
        where: { id, deletedAt: null }, data: { deletedAt: new Date() }, select: { id: true },
      });
    } catch (error) { this.handleError(error); }
  }

  private async validateReferences(ids: Pick<CreateBookDto, 'authorId' | 'publisherId' | 'genreId'>) {
    const author = await this.prisma.author.findUnique({ where: { id: ids.authorId }, select: { id: true } });
    if (!author) throw new BadRequestException('Author not found');
    const publisher = await this.prisma.publisher.findUnique({ where: { id: ids.publisherId }, select: { id: true } });
    if (!publisher) throw new BadRequestException('Publisher not found');
    const genre = await this.prisma.genre.findUnique({ where: { id: ids.genreId }, select: { id: true } });
    if (!genre) throw new BadRequestException('Genre not found');
  }

  private toResponse(book: BookResult): BookResponseDto {
    return { ...book, price: book.price.toFixed(2), createdAt: book.createdAt.toISOString(), updatedAt: book.updatedAt.toISOString() };
  }

  private handleError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') throw new NotFoundException('Book not found');
      // Una referencia puede desaparecer después de la validación; la FK sigue protegiendo la escritura.
      if (error.code === 'P2003') throw new BadRequestException('Invalid author, publisher or genre reference');
    }
    throw new InternalServerErrorException('Unable to process book request');
  }
}
