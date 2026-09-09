import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../shared/components/ErrorMessage';
import { downloadFile } from '../../shared/api/download';
import { getBooks, getMasterData, exportBooks } from './books-api';
import { initialQuery, type BookPage, type MasterData, type SortCriterion } from './types';
import { BookFilters } from './BookFilters';
import { SortControls } from './SortControls';
import { BookTable } from './BookTable';

export function BooksPage() {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortCriterion[]>([{ field: 'createdAt', direction: 'desc' }]);
  const [page, setPage] = useState<BookPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [mastersError, setMastersError] = useState(false);
  const [mastersRetry, setMastersRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  const searchPending = search.trim() !== query.search;

  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => current.search === search.trim() ? current : { ...current, search: search.trim(), page: 1 }), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    getBooks(query, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, result.meta.totalPages);
      if (query.page > lastPage) { setQuery((current) => ({ ...current, page: lastPage })); return; }
      setPage(result); setLoading(false);
    }).catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } });
    // Cancelar e ignorar respuestas antiguas evita mezclar consultas al escribir o cambiar filtros.
    return () => controller.abort();
  }, [query, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setMastersLoading(true); setMastersError(false);
    getMasterData(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setMasters(result); setMastersLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setMastersError(true); setMastersLoading(false); } });
    return () => controller.abort();
  }, [mastersRetry]);
  useEffect(() => () => exportController.current?.abort(), []);

  async function download() {
    if (exporting) return;
    const controller = new AbortController(); exportController.current = controller;
    setExporting(true); setExportError(false);
    try {
      const result = await exportBooks(query, controller.signal);
      if (!controller.signal.aborted) downloadFile(result.blob, result.disposition);
    } catch { if (!controller.signal.aborted) setExportError(true); }
    finally { if (!controller.signal.aborted) setExporting(false); }
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Inventario</p><h1>Libros</h1></div>
      <button onClick={download} disabled={exporting || searchPending}>{exporting ? 'Exportando…' : 'Exportar CSV'}</button></div>
    {exportError && <ErrorMessage>No se pudo descargar el archivo. Inténtalo nuevamente.</ErrorMessage>}
    <section className="card controls" aria-label="Consulta de libros">
      <label>Buscar libros<input type="search" placeholder="Título, autor o editorial" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} /></label>
      {searchPending && <p role="status">Esperando búsqueda…</p>}
      {mastersLoading && <p role="status">Cargando filtros…</p>}
      {mastersError && <ErrorMessage retry={() => setMastersRetry((value) => value + 1)}>No se pudieron cargar los filtros.</ErrorMessage>}
      <BookFilters value={query} masters={masters} loading={mastersLoading} onChange={(patch) => setQuery((current) => ({ ...current, ...patch, page: 1 }))} />
      <SortControls value={sort} onChange={(criteria) => {
        setSort(criteria); setQuery((current) => ({ ...current, page: 1, sort: criteria.map((item) => `${item.field}:${item.direction}`).join(',') }));
      }} />
    </section>
    <section className="card results" aria-label="Resultados" aria-busy={loading}>
      {loading ? <p className="state" role="status">Cargando libros…</p> : error
        ? <ErrorMessage retry={() => setRetry((value) => value + 1)}>No se pudieron cargar los libros.</ErrorMessage>
        : page?.data.length ? <BookTable books={page.data} /> : <p className="state" role="status">No hay libros que coincidan con la búsqueda.</p>}
      <nav className="pagination" aria-label="Paginación">
        <label>Libros por página<select value={query.limit} onChange={(event) => setQuery((current) => ({ ...current, limit: Number(event.target.value), page: 1 }))}>
          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        {!loading && !error && page && <span>Página {page.meta.totalPages ? page.meta.page : 0} de {page.meta.totalPages} · {page.meta.total} libros</span>}
        <div className="page-buttons">
          <button className="secondary" disabled={loading || error || searchPending || query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}>Anterior</button>
          <button className="secondary" disabled={loading || error || searchPending || !page || query.page >= page.meta.totalPages || query.page >= 1000000} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>Siguiente</button>
        </div>
      </nav>
    </section>
  </>;
}
