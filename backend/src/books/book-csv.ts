export function csvRow(values: string[]): string {
  return values.map((value) => {
    // Evita fórmulas al abrir texto no confiable en una hoja de cálculo.
    const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',') + '\r\n';
}
