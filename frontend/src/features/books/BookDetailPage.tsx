import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage } from '../../shared/components/ErrorMessage';
import { getBook } from './books-api';
import { bookError } from './book-errors';
import { BookImage } from './BookImage';
import { DeleteBookButton } from './DeleteBookButton';
import type { Book } from './types';

export function BookDetailPage() {
  const { id = '' } = useParams();
  return <BookDetail key={id} id={id} />;
}

function BookDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getBook(id, controller.signal).then((result) => { if (!controller.signal.aborted) { setBook(result); setLoading(false); } })
      .catch((failure) => { if (!controller.signal.aborted) { setError(bookError(failure, 'No se pudo cargar el libro.')); setLoading(false); } });
    return () => controller.abort();
  }, [id, retry]);

  return <>
    <div className="page-heading"><h1>Detalle de libro</h1><Link to="/books">Volver al listado</Link></div>
    {location.state?.saved === 'created' && <p role="status" className="success">Libro creado correctamente.</p>}
    {location.state?.saved === 'updated' && <p role="status" className="success">Cambios guardados correctamente.</p>}
    {loading ? <p role="status">Cargando libro…</p> : error ? <ErrorMessage retry={() => setRetry((value) => value + 1)}>{error}</ErrorMessage>
      : book && <article className="card book-detail"><BookImage url={book.imageUrl} title={book.title} /><div><h2>{book.title}</h2>
        <dl>{[['Autor', book.author.name], ['Editorial', book.publisher.name], ['Género', book.genre.name], ['Precio', book.price],
          ['Disponibilidad', book.available ? 'Disponible' : 'No disponible']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="form-actions"><Link to={`/books/${book.id}/edit`}>Editar libro</Link>
          <DeleteBookButton book={book} onDeleted={() => navigate('/books', { replace: true, state: { deleted: true } })} /></div>
      </div></article>}
  </>;
}
