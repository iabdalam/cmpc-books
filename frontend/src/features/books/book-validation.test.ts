import { describe, expect, it } from 'vitest';
import { validateBook } from './BookForm';
import { imageSource } from './BookImage';
import { imageFileError, MAX_IMAGE_BYTES } from './BookImageInput';
import { bookError } from './book-errors';
import { ApiError } from '../../shared/api/http';

describe('Book form contract boundaries', () => {
  const fields = { title: 'Title', price: '9999999999.99', available: false, authorId: 'author', publisherId: 'publisher', genreId: 'genre' };
  it('accepts the backend price ceiling and rejects oversized titles and non-boolean availability', () => {
    expect(validateBook(fields)).toEqual({});
    expect(validateBook({ ...fields, title: 'x'.repeat(256) })).toHaveProperty('title');
    expect(validateBook({ ...fields, available: 'false' as unknown as boolean })).toHaveProperty('available');
  });
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s up to the size limit for subsequent decoding', (type) => {
    const file = new File(['data'], 'cover', { type }); Object.defineProperty(file, 'size', { value: MAX_IMAGE_BYTES });
    expect(imageFileError([file])).toBe(''); expect(imageFileError([])).toBe('');
  });
  it.each([null, 'javascript:alert(1)', 'data:image/svg+xml,content', '//other-host/image.png', 'invalid'])('does not render unsafe or invalid persisted URL %s', (url) => {
    expect(imageSource(url)).toBeNull();
  });
  it('resolves local image paths through the API and retains HTTP(S) URLs', () => {
    expect(imageSource('/api/uploads/book.webp')).toBe('/api/uploads/book.webp');
    expect(imageSource('https://example.com/book.png')).toBe('https://example.com/book.png');
  });
  it.each([400, 404, 409, 413, 500])('maps error %s without exposing technical details', (status) => {
    const error = new ApiError(status); error.message = 'Prisma stack password';
    expect(bookError(error, 'No se pudo completar la operación.')).not.toMatch(/Prisma|stack|password/);
  });
});
