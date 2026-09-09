import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage } from '../../shared/components/ErrorMessage';
import { createBook, getBook, getMasterData, updateBook, uploadBookImage } from './books-api';
import { bookError } from './book-errors';
import { BookForm } from './BookForm';
import type { Book, BookInput, MasterData } from './types';

export function BookEditorPage() {
  const { id } = useParams();
  return <BookEditor key={id ?? 'new'} id={id} />;
}

function BookEditor({ id }: { id?: string }) {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<{ book: Book | null; masters: MasterData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [warning, setWarning] = useState('');
  const [saved, setSaved] = useState<Book | null>(null);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('');
    Promise.all([getMasterData(controller.signal), id ? getBook(id, controller.signal) : Promise.resolve(null)])
      .then(([masters, book]) => { if (!controller.signal.aborted) { setInitial({ masters, book }); setLoading(false); } })
      .catch((error) => { if (!controller.signal.aborted) { setLoadError(bookError(error, 'No se pudieron cargar los datos del formulario.')); setLoading(false); } });
    return () => controller.abort();
  }, [id, retry]);
  useEffect(() => () => request.current?.abort(), []);

  async function save(input: BookInput, image: File | null) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setSaveError('');
    const controller = new AbortController(); request.current = controller;
    let result = saved;
    try {
      // Una imagen fallida se reintenta usando el ID confirmado, sin repetir la mutación del libro.
      if (!result) {
        result = id ? await updateBook(id, input, controller.signal) : await createBook(input, controller.signal);
        if (controller.signal.aborted) return;
        setSaved(result);
      }
      if (image) {
        try { await uploadBookImage(result.id, image, controller.signal); }
        catch {
          if (!controller.signal.aborted) setWarning(id
            ? 'Los cambios del libro se guardaron, pero la imagen no se pudo subir. Puedes reintentar solo la imagen o ver el libro guardado.'
            : 'El libro se creó, pero la imagen no se pudo subir. Puedes reintentar solo la imagen o ver el libro guardado.');
          return;
        }
      }
      if (!controller.signal.aborted) navigate(`/books/${result.id}`, { replace: true, state: { saved: id ? 'updated' : 'created' } });
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(bookError(error, 'No se pudo confirmar el guardado. Revisa el listado antes de reintentar.'));
    } finally {
      locked.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <>
    <div className="page-heading"><h1>{id ? 'Editar libro' : 'Nuevo libro'}</h1><Link to="/books">Volver al listado</Link></div>
    {loading ? <p role="status">Cargando formulario…</p> : loadError
      ? <ErrorMessage retry={() => setRetry((value) => value + 1)}>{loadError}</ErrorMessage>
      : initial && <>
        {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
        {warning && <div role="alert" className="warning">{warning}</div>}
        <BookForm book={initial.book} masters={initial.masters} busy={busy} savedId={saved?.id} onSave={save} />
      </>}
  </>;
}
