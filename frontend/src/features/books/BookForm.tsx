import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Book, BookInput, MasterData } from './types';
import { BookImage } from './BookImage';
import { BookImageInput } from './BookImageInput';

interface Fields { title: string; authorId: string; publisherId: string; genreId: string; price: string; available: boolean }
export function validateBook(fields: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!fields.title.trim() || fields.title.trim().length > 255) errors.title = 'El título es obligatorio y admite hasta 255 caracteres.';
  if (!fields.authorId) errors.authorId = 'Selecciona un autor.';
  if (!fields.publisherId) errors.publisherId = 'Selecciona una editorial.';
  if (!fields.genreId) errors.genreId = 'Selecciona un género.';
  if (!/^\d+(?:\.\d{1,2})?$/.test(fields.price) || Number(fields.price) > 9999999999.99) errors.price = 'Ingresa un precio entre 0 y 9999999999.99, con hasta dos decimales.';
  if (typeof fields.available !== 'boolean') errors.available = 'Selecciona una disponibilidad válida.';
  return errors;
}

export function BookForm({ book, masters, busy, savedId, onSave }: {
  book: Book | null; masters: MasterData; busy: boolean; savedId?: string; onSave: (input: BookInput, image: File | null) => void;
}) {
  const [fields, setFields] = useState<Fields>({ title: book?.title ?? '', price: book?.price ?? '', available: book?.available ?? true,
    authorId: book?.author.id ?? '', publisherId: book?.publisher.id ?? '', genreId: book?.genre.id ?? '' });
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageValid, setImageValid] = useState(true);
  const errors = validateBook(fields);
  const visible = (key: keyof Fields) => (submitted || touched[key]) && errors[key];
  function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (busy || !imageValid || Object.keys(errors).length) return;
    onSave({ ...fields, title: fields.title.trim(), price: Number(fields.price) }, image);
  }
  return <form className="card book-form" noValidate onSubmit={submit} aria-label={book ? 'Editar libro' : 'Crear libro'} aria-busy={busy}>
    <fieldset disabled={busy || !!savedId} className="book-fields"><legend>Datos del libro</legend>
      <label>Título<input required maxLength={255} value={fields.title} aria-invalid={!!visible('title')} aria-describedby={visible('title') ? 'title-error' : undefined}
        onChange={(event) => setFields({ ...fields, title: event.target.value })} onBlur={() => setTouched({ ...touched, title: true })} /></label>
      {visible('title') && <p id="title-error" role="alert">{errors.title}</p>}
      <div className="filters">{([
        ['authorId', 'Autor', 'authors'], ['publisherId', 'Editorial', 'publishers'], ['genreId', 'Género', 'genres'],
      ] as const).map(([field, label, collection]) => <div key={field}><label>{label}<select required value={fields[field]} aria-invalid={!!visible(field)} aria-describedby={visible(field) ? `${field}-error` : undefined}
        onChange={(event) => setFields({ ...fields, [field]: event.target.value })} onBlur={() => setTouched({ ...touched, [field]: true })}>
        <option value="">Seleccionar</option>{masters[collection].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>{visible(field) && <p id={`${field}-error`} role="alert">{errors[field]}</p>}</div>)}</div>
      <label>Precio<input required type="text" inputMode="decimal" value={fields.price} aria-invalid={!!visible('price')} aria-describedby={visible('price') ? 'price-error' : undefined}
        onChange={(event) => setFields({ ...fields, price: event.target.value })} onBlur={() => setTouched({ ...touched, price: true })} /></label>
      {visible('price') && <p id="price-error" role="alert">{errors.price}</p>}
      <label className="checkbox"><input type="checkbox" checked={fields.available} onChange={(event) => setFields({ ...fields, available: event.target.checked })} />Disponible</label>
    </fieldset>
    {book?.imageUrl && <div><p>Imagen actual</p><BookImage url={book.imageUrl} title={book.title} /></div>}
    <BookImageInput disabled={busy} onChange={(file, valid) => { setImage(file); setImageValid(valid); }} />
    <div className="form-actions"><button type="submit" disabled={busy || !imageValid}>{busy ? 'Guardando…' : savedId ? image ? 'Reintentar imagen' : 'Ver libro guardado' : book ? 'Guardar cambios' : 'Crear libro'}</button>
      {!busy && <Link to={savedId ? `/books/${savedId}` : book ? `/books/${book.id}` : '/books'}>{savedId ? 'Ver libro guardado' : 'Cancelar'}</Link>}
    </div>
  </form>;
}
