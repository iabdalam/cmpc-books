import { sortFields, type SortCriterion } from './types';

export function SortControls({ value, onChange }: { value: SortCriterion[]; onChange: (value: SortCriterion[]) => void }) {
  const fields = Object.keys(sortFields) as SortCriterion['field'][];
  const available = fields.filter((field) => !value.some((criterion) => criterion.field === field));
  function update(index: number, patch: Partial<SortCriterion>) { onChange(value.map((criterion, position) => position === index ? { ...criterion, ...patch } : criterion)); }
  return <fieldset className="sort-controls"><legend>Ordenar por prioridad</legend>
    {value.map((criterion, index) => <div className="sort-row" key={index}>
      <label>Campo {index + 1}<select value={criterion.field} onChange={(event) => update(index, { field: event.target.value as SortCriterion['field'] })}>
        {fields.map((field) => <option key={field} value={field} disabled={field !== criterion.field && !available.includes(field)}>{sortFields[field]}</option>)}
      </select></label>
      <label>Dirección {index + 1}<select value={criterion.direction} onChange={(event) => update(index, { direction: event.target.value as SortCriterion['direction'] })}>
        <option value="asc">Ascendente</option><option value="desc">Descendente</option>
      </select></label>
      <button className="secondary" aria-label={`Quitar criterio ${index + 1}`} disabled={value.length === 1} onClick={() => onChange(value.filter((_, position) => position !== index))}>Quitar</button>
    </div>)}
    <button className="secondary" disabled={!available.length} onClick={() => onChange([...value, { field: available[0], direction: 'asc' }])}>Agregar criterio</button>
  </fieldset>;
}
