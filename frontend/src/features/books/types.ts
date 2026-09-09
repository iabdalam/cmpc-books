export interface Reference { id: string; name: string }
export interface Book {
  id: string; title: string; price: string; available: boolean; imageUrl: string | null;
  createdAt: string; updatedAt: string; author: Reference; publisher: Reference; genre: Reference;
}
export interface BookPage { data: Book[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export interface BookFilters { search: string; authorId: string; publisherId: string; genreId: string; available: '' | 'true' | 'false' }
export interface BookQuery extends BookFilters { page: number; limit: number; sort: string }
export interface MasterData { authors: Reference[]; publishers: Reference[]; genres: Reference[] }
export const sortFields = { title: 'Título', price: 'Precio', available: 'Disponibilidad', createdAt: 'Fecha de creación', updatedAt: 'Última actualización', id: 'Identificador' };
export interface SortCriterion { field: keyof typeof sortFields; direction: 'asc' | 'desc' }
export const initialQuery: BookQuery = { page: 1, limit: 20, search: '', authorId: '', publisherId: '', genreId: '', available: '', sort: 'createdAt:desc' };
