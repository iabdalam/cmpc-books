import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../../shared/api/http';
import { login } from './auth-api';
import { sessionStore, useSession } from './session';

export function LoginPage() {
  const { session, expired } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (session) return <Navigate to="/books" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim() || !password || new TextEncoder().encode(password).length > 72) {
      setError('Ingresa un correo y una contraseña válida (máximo 72 bytes).'); return;
    }
    const request = new AbortController(); controller.current = request;
    setPending(true); setError('');
    try { const result = await login(email, password, request.signal); if (!request.signal.aborted) sessionStore.set(result); }
    catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof ApiError && failure.status === 401
        ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally { if (!request.signal.aborted) setPending(false); }
  }

  return <main className="login-shell"><section className="card login-card">
    <p className="eyebrow">Inventario de libros</p><h1>CMPC Libros</h1><h2>Iniciar sesión</h2>
    {expired && <p role="status">Tu sesión terminó. Inicia sesión nuevamente.</p>}
    <form onSubmit={submit} aria-busy={pending}>
      <label>Correo electrónico<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  </section></main>;
}
