export function downloadName(disposition: string | null): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="([^"]+)"|filename=([^;]+)/i);
  let name = plain?.[1] ?? plain?.[2]?.trim() ?? 'books.csv';
  if (encoded) { try { name = decodeURIComponent(encoded.trim()); } catch { /* Usa filename o el nombre predeterminado. */ } }
  // El nombre del servidor es un dato no confiable, nunca una ruta local.
  name = name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, '').trim() || 'books.csv';
  return name.endsWith('.csv') ? name : 'books.csv';
}

export function downloadFile(blob: Blob, disposition: string | null) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = downloadName(disposition);
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    // La revocación se difiere para que el navegador inicie la descarga.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
