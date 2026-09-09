import { ApiError } from '../../shared/api/http';

export function bookError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'El libro no existe o ya fue eliminado.';
    if (error.status === 409) return 'El libro cambió durante la operación. Recarga los datos antes de reintentar.';
    if (error.status === 400) return 'Los datos no son válidos. Revisa los campos y las referencias seleccionadas.';
    if (error.status === 413) return 'La imagen supera el máximo de 5 MiB.';
  }
  return fallback;
}
