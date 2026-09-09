import type { BookFilters as Filters, MasterData } from './types';

export function BookFilters({ value, masters, loading, onChange }: {
  value: Filters; masters: MasterData | null; loading: boolean; onChange: (patch: Partial<Filters>) => void;
}) {
  return <div className="filters">
    {([
      ['authorId', 'Autor', 'authors'], ['publisherId', 'Editorial', 'publishers'], ['genreId', 'Género', 'genres'],
    ] as const).map(([field, label, collection]) => <label key={field}>{label}
      <select value={value[field]} disabled={loading || !masters} onChange={(event) => onChange({ [field]: event.target.value })}>
        <option value="">Todos</option>{masters?.[collection].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>)}
    <label>Disponibilidad<select value={value.available} onChange={(event) => onChange({ available: event.target.value as Filters['available'] })}>
      <option value="">Todos</option><option value="true">Disponible</option><option value="false">No disponible</option>
    </select></label>
  </div>;
}
