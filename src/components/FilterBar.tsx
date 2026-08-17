import type { AnimalFilters } from '../types'

export default function FilterBar({ filters, onChange, onClear }: {
  filters: AnimalFilters
  onChange: (next: AnimalFilters) => void
  onClear: () => void
}) {
  function set<K extends keyof AnimalFilters>(key: K, value: AnimalFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="filter-panel">
      <label className="search-field">
        <span>Search</span>
        <input value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Name, breed, city…" />
      </label>
      <label><span>Species</span><select value={filters.species} onChange={(e) => set('species', e.target.value as AnimalFilters['species'])}><option value="">All</option><option value="dog">Dogs</option><option value="cat">Cats</option><option value="other">Other</option></select></label>
      <label><span>Sex</span><select value={filters.sex} onChange={(e) => set('sex', e.target.value as AnimalFilters['sex'])}><option value="">All</option><option value="male">Male</option><option value="female">Female</option><option value="unknown">Unknown</option></select></label>
      <label><span>Size</span><select value={filters.size} onChange={(e) => set('size', e.target.value as AnimalFilters['size'])}><option value="">All</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
      <label><span>City</span><input value={filters.city} onChange={(e) => set('city', e.target.value)} placeholder="Any city" /></label>
      <button className="button button-secondary filter-clear" onClick={onClear}>Clear</button>
    </div>
  )
}
