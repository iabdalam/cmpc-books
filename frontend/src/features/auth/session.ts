import { useSyncExternalStore } from 'react';

export interface Session { accessToken: string; user: { id: string; email: string } }
export const SESSION_KEY = 'cmpc-books.session';

export function tokenExpiry(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) throw new Error('Invalid expiry');
  return payload.exp * 1000;
}

function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Session;
  try {
    return typeof session.accessToken === 'string' && typeof session.user?.id === 'string'
      && typeof session.user.email === 'string' && tokenExpiry(session.accessToken) > Date.now();
  } catch { return false; }
}

function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    if (validSession(value)) return { accessToken: value.accessToken, user: { id: value.user.id, email: value.user.email } };
  } catch { /* Si el navegador bloquea almacenamiento, la sesión puede vivir en memoria. */ }
  try { localStorage.removeItem(SESSION_KEY); } catch { /* El almacenamiento puede estar deshabilitado. */ }
  return null;
}

let state = { session: readSession(), expired: false };
const listeners = new Set<() => void>();
function publish(session: Session | null, expired = false) {
  state = { session, expired };
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  set(value: Session) {
    if (!validSession(value)) throw new Error('Invalid session');
    const session = { accessToken: value.accessToken, user: { id: value.user.id, email: value.user.email } };
    // Decisión del challenge: localStorage persiste el JWT y es accesible ante XSS.
    // Nunca se guarda la contraseña; la firma y autorización las valida el backend.
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* Conserva sesión en memoria. */ }
    publish(session);
  },
  clear(expired = false, expectedToken?: string) {
    // Un 401 tardío de una sesión anterior no debe cerrar un login nuevo.
    if (expectedToken && state.session?.accessToken !== expectedToken) return;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* La limpieza en memoria sigue siendo obligatoria. */ }
    publish(null, expired);
  },
  reload() { publish(readSession()); },
};

export function useSession() { return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot); }
