import { Link, Outlet } from 'react-router-dom';
import { sessionStore, useSession } from '../features/auth/session';

export function Layout() {
  const { session } = useSession();
  return <><header className="header"><Link to="/books" className="brand">CMPC Libros</Link>
    <div className="account"><span>{session?.user.email}</span><button className="secondary" onClick={() => sessionStore.clear()}>Cerrar sesión</button></div>
  </header><main className="workspace"><Outlet /></main></>;
}
