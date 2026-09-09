import { sessionStore, tokenExpiry } from '../../features/auth/session';

export class ApiError extends Error {
  constructor(public readonly status: number) { super('No se pudo completar la solicitud.'); }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
type Options = RequestInit & { public?: boolean };

export async function http(path: string, options: Options = {}): Promise<Response> {
  const { public: isPublic = false, ...init } = options;
  const token = isPublic ? undefined : sessionStore.getSnapshot().session?.accessToken;
  if (!isPublic && (!token || tokenExpiry(token) <= Date.now())) {
    sessionStore.clear(true, token);
    throw new ApiError(401);
  }
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...init, headers }); }
  catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0);
  }
  if (response.status === 401 && !isPublic) sessionStore.clear(true, token);
  // Los cuerpos de error del servidor nunca se muestran directamente al usuario.
  if (!response.ok) throw new ApiError(response.status);
  return response;
}

export async function json<T>(path: string, options?: Options): Promise<T> {
  return (await http(path, options)).json() as Promise<T>;
}
