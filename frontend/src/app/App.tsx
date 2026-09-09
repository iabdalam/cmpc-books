import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { SESSION_KEY, sessionStore, tokenExpiry, useSession } from '../features/auth/session';
import { BooksPage } from '../features/books/BooksPage';
import { BookEditorPage } from '../features/books/BookEditorPage';
import { BookDetailPage } from '../features/books/BookDetailPage';
import { Layout } from './Layout';

export function AppRoutes() {
  const { session } = useSession();
  useEffect(() => {
    if (!session) return;
    const expire = () => { if (tokenExpiry(session.accessToken) <= Date.now()) sessionStore.clear(true, session.accessToken); };
    const timer = window.setTimeout(expire, Math.min(tokenExpiry(session.accessToken) - Date.now(), 2_147_483_647));
    window.addEventListener('focus', expire);
    return () => { clearTimeout(timer); window.removeEventListener('focus', expire); };
  }, [session]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === SESSION_KEY || event.key === null) sessionStore.reload(); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  // Una sesión nueva descarta consultas y datos del usuario anterior al remontar el layout.
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}><Route element={<Layout key={session?.accessToken} />}>
      <Route path="/books" element={<BooksPage />} />
      <Route path="/books/new" element={<BookEditorPage />} />
      <Route path="/books/:id" element={<BookDetailPage />} />
      <Route path="/books/:id/edit" element={<BookEditorPage />} />
    </Route></Route>
    <Route path="*" element={<Navigate to={session ? '/books' : '/login'} replace />} />
  </Routes>;
}

export function App() { return <BrowserRouter><AppRoutes /></BrowserRouter>; }
