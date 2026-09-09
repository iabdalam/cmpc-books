import { useEffect, useRef, useState } from 'react';
import { deleteBook } from './books-api';
import { bookError } from './book-errors';
import type { Book } from './types';

export function DeleteBookButton({ book, onDeleted }: { book: Pick<Book, 'id' | 'title'>; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => request.current?.abort(), []);

  async function remove() {
    if (locked.current || !window.confirm(`¿Eliminar «${book.title}»? El libro dejará de aparecer en el inventario.`)) return;
    locked.current = true; setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try { await deleteBook(book.id, controller.signal); if (!controller.signal.aborted) onDeleted(); }
    catch (failure) { if (!controller.signal.aborted) setError(bookError(failure, 'No se pudo confirmar la eliminación. Actualiza el listado antes de reintentar.')); }
    finally { locked.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  return <div><button className="secondary danger" type="button" disabled={busy} onClick={remove} aria-label={`Eliminar ${book.title}`}>
    {busy ? 'Eliminando…' : 'Eliminar'}</button>{error && <p role="alert">{error}</p>}</div>;
}
