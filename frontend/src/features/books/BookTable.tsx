import type { Book } from './types';

export function BookTable({ books }: { books: Book[] }) {
  return <div className="table-scroll"><table><caption className="sr-only">Libros del inventario</caption>
    <thead><tr>{['Título', 'Autor', 'Editorial', 'Género', 'Precio', 'Disponibilidad'].map((title) => <th scope="col" key={title}>{title}</th>)}</tr></thead>
    <tbody>{books.map((book) => <tr key={book.id}><th scope="row">{book.title}</th><td>{book.author.name}</td><td>{book.publisher.name}</td>
      <td>{book.genre.name}</td><td className="price">{book.price}</td><td><span className={`badge ${book.available ? 'available' : ''}`}>{book.available ? 'Disponible' : 'No disponible'}</span></td></tr>)}</tbody>
  </table></div>;
}
