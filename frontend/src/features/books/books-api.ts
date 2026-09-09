import { http, json } from '../../shared/api/http';
import type { BookFilters, BookPage, BookQuery, MasterData, Reference } from './types';

export function filterParams(filters: BookFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ['search', 'authorId', 'publisherId', 'genreId', 'available'] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params;
}

export function getBooks(query: BookQuery, signal: AbortSignal) {
  const params = filterParams(query);
  // El contrato real del backend usa limit, no pageSize.
  params.set('page', String(query.page)); params.set('limit', String(query.limit)); params.set('sort', query.sort);
  return json<BookPage>(`/books?${params}`, { signal });
}

export async function getMasterData(signal: AbortSignal): Promise<MasterData> {
  const [authors, publishers, genres] = await Promise.all([
    json<Reference[]>('/authors', { signal }), json<Reference[]>('/publishers', { signal }), json<Reference[]>('/genres', { signal }),
  ]);
  return { authors, publishers, genres };
}

export async function exportBooks(filters: BookFilters, signal: AbortSignal) {
  // Exportación no admite sort, page ni limit; incluye todos los resultados filtrados.
  const response = await http(`/books/export?${filterParams(filters)}`, { signal });
  return { blob: await response.blob(), disposition: response.headers.get('Content-Disposition') };
}
