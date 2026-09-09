import { useState } from 'react';
import { baseUrl } from '../../shared/api/http';

export function imageSource(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('/api/uploads/')) return `${baseUrl}/uploads/${value.slice('/api/uploads/'.length)}`;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function BookImage({ url, title }: { url: string | null; title: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = imageSource(url);
  return src && failed !== src
    ? <img className="book-image" src={src} alt={`Imagen de ${title}`} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
    : <p className="image-placeholder">{src ? 'No se pudo cargar la imagen.' : 'Sin imagen'}</p>;
}
