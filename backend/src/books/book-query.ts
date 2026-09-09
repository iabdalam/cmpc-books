import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { BookFiltersDto } from './dto/book-filters.dto';

export function bookWhere(query: BookFiltersDto): Prisma.BookWhereInput {
  // Prisma usa LIKE: escapar comodines conserva el significado literal de la búsqueda.
  const search = query.search?.replace(/[\\%_]/g, '\\$&');
  return {
    deletedAt: null, authorId: query.authorId, publisherId: query.publisherId,
    genreId: query.genreId, available: query.available,
    ...(search ? { OR: [
      { title: { contains: search, mode: 'insensitive' as const } },
      { author: { name: { contains: search, mode: 'insensitive' as const } } },
      { publisher: { name: { contains: search, mode: 'insensitive' as const } } },
    ] } : {}),
  };
}

export function bookOrder(sort = 'createdAt:desc'): Prisma.BookOrderByWithRelationInput[] {
  const allowed = ['title', 'price', 'available', 'createdAt', 'updatedAt', 'id'];
  const used = new Set<string>();
  const result: Prisma.BookOrderByWithRelationInput[] = [];
  for (const term of sort.split(',')) {
    const parts = term.split(':');
    const [field, direction] = parts;
    if (parts.length !== 2 || !allowed.includes(field) || !['asc', 'desc'].includes(direction) || used.has(field)) {
      throw new BadRequestException('Invalid sort: use allowed fields once with asc or desc');
    }
    used.add(field);
    result.push({ [field]: direction });
  }
  // El desempate estable evita que una fila cambie de página por valores iguales.
  if (!used.has('id')) result.push({ id: 'asc' });
  return result;
}
