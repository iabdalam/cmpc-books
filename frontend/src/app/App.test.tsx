import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App, AppRoutes } from './App';
import { SESSION_KEY, sessionStore } from '../features/auth/session';
import { book, bookPage, deferred, makeSession, mockApi, reference, response } from '../test/fixtures';

function renderApp(path = '/books', authenticated = true) {
  if (authenticated) sessionStore.set(makeSession());
  return render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
}
function bookCalls(fetch: ReturnType<typeof mockApi>) { return fetch.mock.calls.filter(([url]) => String(url).startsWith('/api/books?')); }
function lastQuery(fetch: ReturnType<typeof mockApi>) { return new URL(String(bookCalls(fetch).at(-1)![0]), 'http://localhost').searchParams; }
async function loaded() { await screen.findByRole('table'); }
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }

// Las respuestas de prueba conservan los DTO reales del backend.
describe('Frontend routes and inventory flows', () => {
  it('renders the public entry screen using the browser router', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'CMPC Libros' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent('Inventario de libros');
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
  it.each(['/books', '/unknown'])('protects or redirects %s without requesting data', (path) => {
    const fetch = mockApi(); renderApp(path, false);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['/login', '/unknown'])('redirects an authenticated user from %s to books', async (path) => {
    mockApi(); renderApp(path); await loaded(); expect(screen.getByRole('heading', { name: 'Libros' })).toBeVisible();
  });
  it('logs in, stores only public session data, shows email, and logs out', async () => {
    const fetch = mockApi(); renderApp('/login', false);
    change('Correo electrónico', 'DEMO@example.com'); change('Contraseña', 'development-password');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' })); await loaded();
    const login = fetch.mock.calls.find(([url]) => url === '/api/auth/login')!;
    expect(JSON.parse(login[1]!.body as string)).toEqual({ email: 'demo@example.com', password: 'development-password' });
    expect(localStorage.getItem(SESSION_KEY)).not.toContain('development-password');
    expect(screen.getByText('demo@example.com')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible(); expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it.each([401, 500])('shows a safe login failure for %s', async (status) => {
    const fetch = mockApi(); fetch.mockResolvedValue(response({ message: 'internal passwordHash stack' }, status)); renderApp('/login', false);
    change('Correo electrónico', 'demo@example.com'); change('Contraseña', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401 ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión.');
    expect(document.body).not.toHaveTextContent('passwordHash'); expect(sessionStore.getSnapshot().session).toBeNull();
  });
  it('prevents duplicate login while pending and aborts on unmount', async () => {
    const fetch = mockApi(); const pending = deferred<Response>(); fetch.mockReturnValue(pending.promise);
    const view = renderApp('/login', false); change('Correo electrónico', 'demo@example.com'); change('Contraseña', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Ingresando…' }).closest('form')!);
    expect(fetch).toHaveBeenCalledTimes(1); const signal = fetch.mock.calls[0][1]!.signal!;
    view.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(response(makeSession()))); expect(sessionStore.getSnapshot().session).toBeNull();
  });
  it('validates required credentials, email and the bcrypt byte limit', () => {
    const fetch = mockApi(); renderApp('/login', false);
    const button = screen.getByRole('button', { name: 'Ingresar' });
    fireEvent.click(button); expect(fetch).not.toHaveBeenCalled();
    change('Correo electrónico', 'not-email'); change('Contraseña', 'password');
    expect(screen.getByLabelText('Correo electrónico')).toBeInvalid();
    change('Correo electrónico', 'demo@example.com'); change('Contraseña', 'é'.repeat(37)); fireEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('máximo 72 bytes'); expect(fetch).not.toHaveBeenCalled();
    change('Contraseña', ''); fireEvent.submit(button.closest('form')!); expect(fetch).not.toHaveBeenCalled();
  });
  it('expires session while the page is open', async () => {
    mockApi(); sessionStore.set(makeSession(Math.floor(Date.now() / 1000) + 2)); renderApp('/books', false); await loaded();
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 3000);
    act(() => window.dispatchEvent(new Event('focus')));
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible(); expect(screen.getByRole('status')).toHaveTextContent('Tu sesión terminó');
  });
  it('synchronizes logout from another tab', async () => {
    mockApi(); renderApp(); await loaded();
    localStorage.removeItem(SESSION_KEY);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
    expect(screen.getByRole('table')).toBeVisible();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });
  it('expires automatically without user interaction', async () => {
    vi.useFakeTimers(); mockApi();
    sessionStore.set(makeSession(Math.floor(Date.now() / 1000) + 2)); renderApp('/books', false);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('discards previous data and reloads queries when another tab changes the session', async () => {
    const fetch = mockApi(); renderApp(); await loaded();
    const count = bookCalls(fetch).length;
    localStorage.setItem(SESSION_KEY, JSON.stringify(makeSession(undefined, 'new-session')));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
    await loaded(); expect(bookCalls(fetch)).toHaveLength(count + 1);
    const headers = bookCalls(fetch).at(-1)![1]!.headers as Headers;
    expect(headers.get('Authorization')).toContain('new-session');
  });
  it('clears session and redirects on a protected 401', async () => {
    const fetch = mockApi(); fetch.mockResolvedValue(response({ message: 'private' }, 401)); renderApp();
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeVisible(); expect(screen.getByRole('status')).toHaveTextContent('Tu sesión terminó');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('renders the real book shape, price and availability', async () => {
    const fetch = mockApi(); fetch.mockImplementation(async (url) => String(url).startsWith('/api/books?')
      ? response({ ...bookPage, data: [book, { ...book, id: 'other', title: 'Otro libro', available: false }] }) : response([reference]));
    renderApp(); await loaded();
    const table = screen.getByRole('table');
    for (const value of [book.title, 'Isabel Allende', 'Alfaguara', 'Novela', 'Disponible', 'No disponible']) expect(within(table).getAllByText(value)[0]).toBeVisible();
    expect(within(table).getAllByText('12990.00')).toHaveLength(2);
    expect(lastQuery(fetch).get('limit')).toBe('20'); expect(lastQuery(fetch).has('pageSize')).toBe(false);
  });
  it.each([['Autor', 'authorId'], ['Editorial', 'publisherId'], ['Género', 'genreId'], ['Disponibilidad', 'available']])('filters by %s and resets the page', async (label, field) => {
    const fetch = mockApi(); renderApp(); await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); await screen.findByText('Página 2 de 3 · 41 libros');
    const value = field === 'available' ? 'false' : reference.id; change(label, value);
    await waitFor(() => expect(lastQuery(fetch).get(field)).toBe(value)); expect(lastQuery(fetch).get('page')).toBe('1');
    change(label, ''); await waitFor(() => expect(lastQuery(fetch).has(field)).toBe(false));
  });
  it('debounces typing for 400ms and resets page without sending each keystroke', async () => {
    const fetch = mockApi(); renderApp(); await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Página 2 de 3 · 41 libros'); vi.useFakeTimers(); const count = bookCalls(fetch).length;
    change('Buscar libros', 'a'); change('Buscar libros', 'ab'); change('Buscar libros', '  abc  ');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(399); }); expect(bookCalls(fetch)).toHaveLength(count);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(bookCalls(fetch)).toHaveLength(count + 1); expect(lastQuery(fetch).get('search')).toBe('abc'); expect(lastQuery(fetch).get('page')).toBe('1');
    change('Buscar libros', ''); await act(async () => { await vi.advanceTimersByTimeAsync(400); }); expect(lastQuery(fetch).has('search')).toBe(false);
  });
  it('paginates using server metadata and changes the supported limit', async () => {
    const fetch = mockApi(); renderApp(); await loaded();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); await screen.findByText('Página 2 de 3 · 41 libros');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); await screen.findByText('Página 3 de 3 · 41 libros');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' })); await screen.findByText('Página 2 de 3 · 41 libros');
    change('Libros por página', '50'); await waitFor(() => expect(lastQuery(fetch).get('limit')).toBe('50')); expect(lastQuery(fetch).get('page')).toBe('1');
  });
  it('supports multi-field sort in priority order, prevents duplicates and resets page', async () => {
    const fetch = mockApi(); renderApp(); await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); await screen.findByText('Página 2 de 3 · 41 libros');
    change('Campo 1', 'title'); change('Dirección 1', 'asc'); fireEvent.click(screen.getByRole('button', { name: 'Agregar criterio' }));
    change('Campo 2', 'price'); change('Dirección 2', 'desc');
    await waitFor(() => expect(lastQuery(fetch).get('sort')).toBe('title:asc,price:desc')); expect(lastQuery(fetch).get('page')).toBe('1');
    expect(within(screen.getByLabelText('Campo 2')).getByRole('option', { name: 'Título' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar criterio 1' })); await waitFor(() => expect(lastQuery(fetch).get('sort')).toBe('price:desc'));
    expect(screen.getByRole('button', { name: 'Quitar criterio 1' })).toBeDisabled();
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar criterio' }));
    expect(screen.getByRole('button', { name: 'Agregar criterio' })).toBeDisabled();
  });
  it('shows loading, empty results and zero-page metadata', async () => {
    const fetch = mockApi(); const pending = deferred<Response>(); const original = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, init) => String(url).startsWith('/api/books?') ? pending.promise : original(url, init)); renderApp();
    expect(screen.getByText('Cargando libros…')).toBeVisible(); expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    await act(async () => pending.resolve(response({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })));
    expect(screen.getByText('No hay libros que coincidan con la búsqueda.')).toBeVisible(); expect(screen.getByText('Página 0 de 0 · 0 libros')).toBeVisible();
  });
  it('shows a safe list error and retries successfully', async () => {
    const fetch = mockApi(); const original = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, init) => String(url).startsWith('/api/books?') ? Promise.resolve(response({ stack: 'secret' }, 500)) : original(url, init)); renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los libros.'); expect(document.body).not.toHaveTextContent('secret');
    fetch.mockImplementation(original); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await loaded();
  });
  it('retries failed master data without preventing the list from rendering', async () => {
    const fetch = mockApi(); const original = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, init) => url === '/api/authors' ? Promise.resolve(response({}, 500)) : original(url, init)); renderApp(); await loaded();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los filtros.'); expect(screen.getByLabelText('Autor')).toBeDisabled();
    fetch.mockImplementation(original); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByLabelText('Autor')).toBeEnabled());
  });
  it('ignores stale results when filters change', async () => {
    const fetch = mockApi(); const original = fetch.getMockImplementation()!; const pending = deferred<Response>(); let first = true;
    fetch.mockImplementation((url, init) => { if (String(url).startsWith('/api/books?') && first) { first = false; return pending.promise; } return original(url, init); });
    renderApp(); change('Disponibilidad', 'false'); await loaded();
    const oldSignal = bookCalls(fetch)[0][1]!.signal!; expect(oldSignal.aborted).toBe(true);
    await act(async () => pending.resolve(response({ ...bookPage, data: [{ ...book, title: 'Stale result' }] })));
    expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
  });
  it('recovers when the last page disappears on the server', async () => {
    const fetch = mockApi(); renderApp(); await loaded();
    const original = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, init) => String(url).includes('page=2') ? Promise.resolve(response({ data: [], meta: { ...bookPage.meta, page: 2, totalPages: 1, total: 1 } })) : original(url, init));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(bookCalls(fetch).length).toBe(3)); expect(lastQuery(fetch).get('page')).toBe('1'); await loaded();
  });
  it('exports only supported filters, downloads the server filename and handles errors', async () => {
    const fetch = mockApi(); renderApp(); await loaded(); change('Disponibilidad', 'false'); await loaded();
    const create = vi.fn().mockReturnValue('blob:download'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let filename = ''; vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(filename).toBe('inventario.csv'));
    const url = new URL(String(fetch.mock.calls.find(([url]) => String(url).startsWith('/api/books/export'))![0]), 'http://localhost');
    expect([...url.searchParams.entries()]).toEqual([['available', 'false']]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled());
    const original = fetch.getMockImplementation()!; fetch.mockImplementation((url, init) => String(url).startsWith('/api/books/export') ? Promise.resolve(response({}, 500)) : original(url, init));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' })); expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo descargar');
  });
  it('disables duplicate exports and aborts downloads on logout', async () => {
    const fetch = mockApi(); renderApp(); await loaded(); const original = fetch.getMockImplementation()!; const pending = deferred<Response>();
    fetch.mockImplementation((url, init) => String(url).startsWith('/api/books/export') ? pending.promise : original(url, init));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' })); expect(screen.getByRole('button', { name: 'Exportando…' })).toBeDisabled();
    const signal = fetch.mock.calls.find(([url]) => String(url).startsWith('/api/books/export'))![1]!.signal!;
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' })); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(new Response('csv'))); expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });
});
