import { vi } from 'vitest';
import type { Session } from '../features/auth/session';
import type { Book, BookPage } from '../features/books/types';

export function makeSession(exp = Math.floor(Date.now() / 1000) + 900, signature = 'test'): Session {
  return { accessToken: `${btoa('{}')}.${btoa(JSON.stringify({ sub: 'user-id', exp }))}.${signature}`, user: { id: 'user-id', email: 'demo@example.com' } };
}
export const reference = { id: '61c2434c-afd3-4ddb-9de2-210ca43b0869', name: 'Referencia' };
export const book: Book = { id: 'book-id', title: 'La casa de los espíritus', price: '12990.00', available: true,
  imageUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  author: { ...reference, name: 'Isabel Allende' }, publisher: { ...reference, name: 'Alfaguara' }, genre: { ...reference, name: 'Novela' } };
export const bookPage: BookPage = { data: [book], meta: { page: 1, limit: 20, total: 41, totalPages: 3 } };
export function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
export function mockApi() {
  const fetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/auth/login') return response(makeSession());
    if (url.pathname === '/api/books/export') return new Response('"title"\r\n"Book"\r\n', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="inventario.csv"' } });
    if (url.pathname === '/api/books') return response({ ...bookPage, meta: { ...bookPage.meta, page: Number(url.searchParams.get('page')), limit: Number(url.searchParams.get('limit')) } });
    return response([reference]);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
