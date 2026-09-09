import { useEffect, useRef, useState } from 'react';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function imageFileError(files: FileList | File[]): string {
  if (files.length > 1) return 'Selecciona una sola imagen.';
  const file = files[0];
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Usa una imagen JPEG, PNG o WebP.';
  if (!file.size || file.size > MAX_IMAGE_BYTES) return 'La imagen debe tener contenido y no superar 5 MiB.';
  return '';
}

export function BookImageInput({ disabled, onChange }: { disabled: boolean; onChange: (file: File | null, valid: boolean) => void }) {
  const [candidate, setCandidate] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!candidate) { setPreview(''); return; }
    const url = URL.createObjectURL(candidate); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [candidate]);

  function clear() {
    setCandidate(null); setPreview(''); setError(''); setChecking(false); onChange(null, true);
    if (input.current) input.current.value = '';
  }

  return <div className="image-input">
    <label>Imagen opcional<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby="image-help image-error"
      onChange={(event) => {
        const files = event.target.files;
        if (!files?.length) { clear(); return; }
        const message = imageFileError(files); setError(message); setPreview('');
        setCandidate(message ? null : files[0]); setChecking(!message); onChange(null, false);
      }} /></label>
    <p id="image-help">Una imagen fija JPEG, PNG o WebP, hasta 5 MiB y 20 millones de píxeles. La imagen actual se conserva si no eliges otra.</p>
    {checking && <p role="status">Validando imagen…</p>}
    {/* El navegador comprueba decodificación y dimensiones; el backend verifica formato real y ausencia de animación. */}
    {preview && candidate && <img key={preview} className="book-image" src={preview} alt="Vista previa de la nueva imagen"
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (!naturalWidth || !naturalHeight || naturalWidth * naturalHeight > 20_000_000) {
          setError('La imagen no es válida o supera 20 millones de píxeles.'); onChange(null, false);
        } else { setError(''); onChange(candidate, true); }
        setChecking(false);
      }}
      onError={() => { setError('No se pudo leer la imagen. Selecciona otro archivo.'); setChecking(false); onChange(null, false); }} />}
    {error && <p id="image-error" role="alert">{error}</p>}
    {(candidate || error) && <button className="secondary" type="button" disabled={disabled} onClick={clear}>Descartar imagen seleccionada</button>}
  </div>;
}
