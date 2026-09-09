import type { Book } from './types';
import { Link } from 'react-router-dom';
import { DeleteBookButton } from './DeleteBookButton';

export function BookTable({ books, onDeleted }: { books: Book[]; onDeleted: () => void }) {
  return <div className="table-scroll"><table><caption className="sr-only">Libros del inventario</caption>
    <thead><tr>{['Título', 'Autor', 'Editorial', 'Género', 'Precio', 'Disponibilidad', 'Acciones'].map((title) => <th scope="col" key={title}>{title}</th>)}</tr></thead>
    <tbody>{books.map((book) => <tr key={book.id}><th scope="row">{book.title}</th><td>{book.author.name}</td><td>{book.publisher.name}</td>
      <td>{book.genre.name}</td><td className="price">{book.price}</td><td><span className={`badge ${book.available ? 'available' : ''}`}>{book.available ? 'Disponible' : 'No disponible'}</span></td>
      <td><div className="row-actions"><Link to={`/books/${book.id}`} aria-label={`Ver detalle de ${book.title}`}>Ver detalle</Link>
        <Link to={`/books/${book.id}/edit`} aria-label={`Editar ${book.title}`}>Editar</Link><DeleteBookButton book={book} onDeleted={onDeleted} /></div></td></tr>)}</tbody>
  </table></div>;
}
