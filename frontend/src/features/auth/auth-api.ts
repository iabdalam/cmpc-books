import { json } from '../../shared/api/http';
import type { Session } from './session';

export function login(email: string, password: string, signal?: AbortSignal) {
  return json<Session>('/auth/login', { public: true, method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }), signal });
}
