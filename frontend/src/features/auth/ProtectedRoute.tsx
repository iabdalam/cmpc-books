import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './session';

export function ProtectedRoute() {
  const { session } = useSession();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
