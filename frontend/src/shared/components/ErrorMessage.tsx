export function ErrorMessage({ children, retry }: { children: string; retry?: () => void }) {
  return <div className="error" role="alert"><p>{children}</p>{retry && <button className="secondary" onClick={retry}>Reintentar</button>}</div>;
}
