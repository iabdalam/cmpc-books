import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../app/App';
import { sessionStore } from '../auth/session';
import { book, deferred, makeSession, mockApi, reference, response } from '../../test/fixtures';
import type { BookInput } from './types';

const id = 'b7460bb6-7d26-4af9-9f68-c106aedbf924';
const initialBook = { ...book, id };
const input: BookInput = { title: 'Nuevo título', price: 12.5, available: false, authorId: reference.id, publisherId: reference.id, genreId: reference.id };

function mockBooks(imageUrl: string | null = null) {
  const fetch = mockApi(); const base = fetch.getMockImplementation()!;
  let saved = { ...initialBook, imageUrl }; let deleted = false;
  fetch.mockImplementation(async (url, options) => {
    const path = String(url).split('?')[0];
    if (path === `/api/books/${id}/image`) { saved = { ...saved, imageUrl: '/api/uploads/new.webp' }; return response(saved); }
    if (path === `/api/books/${id}` && options?.method === 'DELETE') { deleted = true; return new Response(null, { status: 204 }); }
    if ((path === '/api/books' && options?.method === 'POST') || (path === `/api/books/${id}` && options?.method === 'PATCH')) {
      const data = JSON.parse(options.body as string) as BookInput;
      saved = { ...saved, title: data.title, available: data.available, price: data.price.toFixed(2) };
      return response(saved, options.method === 'POST' ? 201 : 200);
    }
    if (path === `/api/books/${id}`) return deleted ? response({}, 404) : response(saved);
    if (path === '/api/books') return response({ data: deleted ? [] : [saved], meta: { page: 1, limit: 20, total: deleted ? 0 : 1, totalPages: deleted ? 0 : 1 } });
    return base(url, options);
  });
  return fetch;
}
function view(path = '/books/new', authenticated = true) {
  if (authenticated) sessionStore.set(makeSession());
  return render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
}
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
async function fill() {
  await screen.findByRole('form');
  change('Título', `  ${input.title}  `); change('Precio', '12.50');
  for (const field of ['Autor', 'Editorial', 'Género']) change(field, reference.id);
  if ((screen.getByLabelText('Disponible') as HTMLInputElement).checked) fireEvent.click(screen.getByLabelText('Disponible'));
}
function mutationCalls(fetch: ReturnType<typeof mockBooks>, method: string) { return fetch.mock.calls.filter(([, options]) => options?.method === method); }
function selectImage(files = [new File(['image'], 'book.png', { type: 'image/png' })]) {
  fireEvent.change(screen.getByLabelText('Imagen opcional'), { target: { files } });
}
async function loadPreview(width = 10, height = 10) {
  const image = await screen.findByAltText('Vista previa de la nueva imagen');
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
  fireEvent.load(image);
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:preview') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

describe('Book routes and forms', () => {
  it.each(['/books/new', `/books/${id}`, `/books/${id}/edit`])('protects %s', (path) => {
    const fetch = mockBooks(); view(path, false);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeVisible(); expect(fetch).not.toHaveBeenCalled();
  });
  it('navigates from listing to new, detail and edit', async () => {
    mockBooks(); view('/books'); await screen.findByRole('table');
    fireEvent.click(screen.getByRole('link', { name: 'Nuevo libro' })); await screen.findByRole('form', { name: 'Crear libro' });
    fireEvent.click(screen.getByRole('link', { name: 'Cancelar' })); await screen.findByRole('table');
    fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${book.title}` })); await screen.findByRole('heading', { name: book.title });
    fireEvent.click(screen.getByRole('link', { name: 'Editar libro' })); await screen.findByRole('form', { name: 'Editar libro' });
    fireEvent.click(screen.getByRole('link', { name: 'Volver al listado' })); await screen.findByRole('table');
    fireEvent.click(screen.getByRole('link', { name: `Editar ${book.title}` })); expect(await screen.findByRole('form')).toBeVisible();
  });
  it('creates valid JSON using master IDs, a numeric price and a boolean', async () => {
    const fetch = mockBooks(); view(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Crear libro' }));
    expect(await screen.findByRole('heading', { name: input.title })).toBeVisible(); expect(screen.getByText('Libro creado correctamente.')).toBeVisible();
    const post = mutationCalls(fetch, 'POST'); expect(post).toHaveLength(1); expect(post[0][0]).toBe('/api/books');
    expect(JSON.parse(post[0][1]!.body as string)).toEqual(input);
    expect((post[0][1]!.headers as Headers).get('Content-Type')).toBe('application/json');
  });
  it('validates required values and reacts when fields are corrected', async () => {
    const fetch = mockBooks(); view(); await screen.findByRole('form');
    fireEvent.click(screen.getByRole('button', { name: 'Crear libro' })); expect(screen.getAllByRole('alert')).toHaveLength(5);
    expect(mutationCalls(fetch, 'POST')).toHaveLength(0);
    await fill(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    change('Título', '   '); fireEvent.blur(screen.getByLabelText('Título'));
    expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Crear libro' })); expect(mutationCalls(fetch, 'POST')).toHaveLength(0);
  });
  it.each(['', 'abc', '-1', '0.001', '10000000000', 'Infinity', '1e3'])('rejects invalid price %s', async (value) => {
    const fetch = mockBooks(); view(); await fill(); change('Precio', value); fireEvent.blur(screen.getByLabelText('Precio'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear libro' })); expect(screen.getByRole('alert')).toHaveTextContent('hasta dos decimales');
    expect(mutationCalls(fetch, 'POST')).toHaveLength(0);
  });
  it('accepts zero price', async () => {
    const fetch = mockBooks(); view(); await fill(); change('Precio', '0'); fireEvent.click(screen.getByRole('button', { name: 'Crear libro' }));
    await screen.findByText('Libro creado correctamente.'); expect(JSON.parse(mutationCalls(fetch, 'POST')[0][1]!.body as string).price).toBe(0);
  });
  it('preserves inputs and sanitizes a create failure', async () => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, options) => options?.method === 'POST' ? Promise.resolve(response({ stack: 'Prisma passwordHash' }, 500)) : base(url, options));
    view(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Crear libro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar el guardado');
    expect(screen.getByLabelText('Título')).toHaveValue(`  ${input.title}  `); expect(document.body).not.toHaveTextContent('Prisma');
  });
  it('prevents duplicate submits and aborts an in-flight save on unmount', async () => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!; const pending = deferred<Response>();
    fetch.mockImplementation((url, options) => options?.method === 'POST' ? pending.promise : base(url, options));
    const rendered = view(); await fill(); fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled(); expect(mutationCalls(fetch, 'POST')).toHaveLength(1);
    const signal = mutationCalls(fetch, 'POST')[0][1]!.signal!; rendered.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(response(initialBook, 201)));
  });
  it('loads edit values and preserves the existing image without echoing imageUrl', async () => {
    const fetch = mockBooks('/api/uploads/existing.webp'); view(`/books/${id}/edit`);
    expect(screen.getByText('Cargando formulario…')).toBeVisible(); await screen.findByRole('form');
    expect(screen.getByLabelText('Título')).toHaveValue(book.title); expect(screen.getByLabelText('Precio')).toHaveValue(book.price);
    expect(screen.getByLabelText('Autor')).toHaveValue(reference.id); expect(screen.getByLabelText('Disponible')).toBeChecked();
    expect(screen.getByAltText(`Imagen de ${book.title}`)).toHaveAttribute('src', '/api/uploads/existing.webp');
    change('Título', 'Editado'); fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Editado' }); expect(screen.getByText('Cambios guardados correctamente.')).toBeVisible();
    const patch = mutationCalls(fetch, 'PATCH')[0]; expect(patch[0]).toBe(`/api/books/${id}`);
    expect(JSON.parse(patch[1]!.body as string)).not.toHaveProperty('imageUrl'); expect(mutationCalls(fetch, 'POST')).toHaveLength(0);
  });
  it('reports unavailable edit data and allows a retry', async () => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, options) => url === `/api/books/${id}` ? Promise.resolve(response({}, 404)) : base(url, options));
    view(`/books/${id}/edit`); expect(await screen.findByRole('alert')).toHaveTextContent('El libro no existe o ya fue eliminado');
    expect(screen.queryByRole('form')).not.toBeInTheDocument(); fetch.mockImplementation(base);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await screen.findByRole('form');
  });
  it('reports master-data load errors before exposing the form', async () => {
    const fetch = mockBooks(); fetch.mockResolvedValue(response({}, 500)); view();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos del formulario');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});

describe('Detail and soft deletion UI', () => {
  it('displays real detail fields and an optional image', async () => {
    mockBooks('https://example.com/book.png'); view(`/books/${id}`); expect(screen.getByText('Cargando libro…')).toBeVisible();
    await screen.findByRole('heading', { name: book.title });
    for (const value of [book.author.name, book.publisher.name, book.genre.name, book.price, 'Disponible']) expect(screen.getByText(value)).toBeVisible();
    fireEvent.error(screen.getByAltText(`Imagen de ${book.title}`)); expect(screen.getByText('No se pudo cargar la imagen.')).toBeVisible();
  });
  it('handles a missing detail safely and retries', async () => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!; fetch.mockResolvedValue(response({}, 404)); view(`/books/${id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('El libro no existe o ya fue eliminado');
    fetch.mockImplementation(base); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: book.title }); expect(screen.getByText('Sin imagen')).toBeVisible();
  });
  it.each(['/books', `/books/${id}`])('cancels deletion from %s without sending a request', async (path) => {
    const fetch = mockBooks(); vi.spyOn(window, 'confirm').mockReturnValue(false); view(path);
    fireEvent.click(await screen.findByRole('button', { name: `Eliminar ${book.title}` }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining(book.title)); expect(mutationCalls(fetch, 'DELETE')).toHaveLength(0);
  });
  it.each(['/books', `/books/${id}`])('confirms deletion from %s and returns to the refreshed list', async (path) => {
    const fetch = mockBooks(); vi.spyOn(window, 'confirm').mockReturnValue(true); view(path);
    fireEvent.click(await screen.findByRole('button', { name: `Eliminar ${book.title}` }));
    expect(await screen.findByText('Libro eliminado correctamente.')).toBeVisible(); await screen.findByText('No hay libros que coincidan con la búsqueda.');
    expect(mutationCalls(fetch, 'DELETE')).toHaveLength(1); expect(mutationCalls(fetch, 'DELETE')[0][0]).toBe(`/api/books/${id}`);
  });
  it('keeps detail visible after a failed delete and blocks duplicate requests while pending', async () => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!; const pending = deferred<Response>();
    fetch.mockImplementation((url, options) => options?.method === 'DELETE' ? pending.promise : base(url, options));
    vi.spyOn(window, 'confirm').mockReturnValue(true); view(`/books/${id}`);
    const button = await screen.findByRole('button', { name: `Eliminar ${book.title}` }); fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled(); expect(mutationCalls(fetch, 'DELETE')).toHaveLength(1);
    await act(async () => pending.resolve(response({ message: 'Prisma internal' }, 409)));
    expect(screen.getByRole('alert')).toHaveTextContent('Recarga los datos'); expect(document.body).not.toHaveTextContent('Prisma');
    expect(screen.getByRole('heading', { name: book.title })).toBeVisible();
  });
});

describe('Image creation and replacement', () => {
  it.each(['/books/new', `/books/${id}/edit`])('uploads multipart file after saving from %s', async (path) => {
    const fetch = mockBooks('/api/uploads/existing.webp'); view(path); await fill();
    const file = new File(['png'], 'cover.png', { type: 'image/png' }); selectImage([file]);
    expect(screen.getByRole('button', { name: path.endsWith('new') ? 'Crear libro' : 'Guardar cambios' })).toBeDisabled();
    await loadPreview(); fireEvent.submit(screen.getByRole('form'));
    await screen.findByRole('heading', { name: input.title });
    const upload = fetch.mock.calls.find(([url]) => url === `/api/books/${id}/image`)!;
    expect(upload[1]!.body).toBeInstanceOf(FormData); expect((upload[1]!.body as FormData).get('file')).toBe(file);
    expect((upload[1]!.headers as Headers).has('Content-Type')).toBe(false); expect((upload[1]!.headers as Headers).get('Authorization')).toMatch(/^Bearer /);
    const mutation = fetch.mock.calls.findIndex(([, options]) => options?.method === (path.endsWith('new') ? 'POST' : 'PATCH'));
    expect(fetch.mock.calls.indexOf(upload)).toBeGreaterThan(mutation);
    expect(screen.getByAltText(`Imagen de ${input.title}`)).toHaveAttribute('src', '/api/uploads/new.webp'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
  it.each(['/books/new', `/books/${id}/edit`])('reports partial success and retries only the failed image from %s', async (path) => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, options) => String(url).endsWith('/image') ? Promise.resolve(response({ stack: 'private' }, 500)) : base(url, options));
    view(path); await fill(); selectImage(); await loadPreview(); fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(path.endsWith('new') ? 'El libro se creó, pero la imagen no se pudo subir' : 'Los cambios del libro se guardaron, pero la imagen no se pudo subir');
    expect(screen.getByLabelText('Título')).toBeDisabled(); expect(document.body).not.toHaveTextContent('private');
    fetch.mockImplementation(base); fireEvent.click(screen.getByRole('button', { name: 'Reintentar imagen' }));
    await screen.findByRole('heading', { name: input.title });
    expect(fetch.mock.calls.filter(([url, options]) => !String(url).endsWith('/image') && ['POST', 'PATCH'].includes(options?.method ?? ''))).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/image'))).toHaveLength(2);
  });
  it('allows discarding a failed image and viewing the already-created book', async () => {
    const fetch = mockBooks(); const base = fetch.getMockImplementation()!;
    fetch.mockImplementation((url, options) => String(url).endsWith('/image') ? Promise.resolve(response({}, 400)) : base(url, options));
    view(); await fill(); selectImage(); await loadPreview(); fireEvent.submit(screen.getByRole('form')); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar imagen seleccionada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver libro guardado' })); await screen.findByRole('heading', { name: input.title });
    expect(mutationCalls(fetch, 'POST')).toHaveLength(2);
  });
  it.each([
    [new File(['svg'], 'image.svg', { type: 'image/svg+xml' })],
    [new File([], 'image.png', { type: 'image/png' })],
    [new File(['x'], 'one.png', { type: 'image/png' }), new File(['x'], 'two.png', { type: 'image/png' })],
  ])('rejects unsuitable files before sending any mutation %#', async (...files) => {
    const fetch = mockBooks(); view(); await fill(); selectImage(files); expect(screen.getByRole('alert')).toBeVisible();
    fireEvent.submit(screen.getByRole('form')); expect(mutationCalls(fetch, 'POST')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar imagen seleccionada' })); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('rejects oversized files and decoded dimensions', async () => {
    const fetch = mockBooks(); view(); await fill();
    const file = new File(['x'], 'large.png', { type: 'image/png' }); Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 }); selectImage([file]);
    expect(screen.getByRole('alert')).toHaveTextContent('5 MiB'); selectImage(); await loadPreview(5000, 5000);
    expect(screen.getByRole('alert')).toHaveTextContent('20 millones'); fireEvent.submit(screen.getByRole('form')); expect(mutationCalls(fetch, 'POST')).toHaveLength(0);
  });
  it('rejects unreadable image content and handles clearing the file selection', async () => {
    mockBooks(); view(); await fill(); selectImage(); fireEvent.error(await screen.findByAltText('Vista previa de la nueva imagen'));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer la imagen');
    selectImage([]); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Crear libro' })).toBeEnabled();
  });
});
