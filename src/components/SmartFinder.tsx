import { useState } from 'react'
import { parseAdoptionQuery } from '../lib/smartSearch'
import type { AnimalFilters } from '../types'

export default function SmartFinder({ onApply, onClear, chips }: {
  onApply: (filters: Partial<AnimalFilters>, chips: string[]) => void
  onClear: () => void
  chips: string[]
}) {
  const [query, setQuery] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseAdoptionQuery(query)
    onApply(parsed.filters, parsed.chips)
  }

  return (
    <div className="smart-finder">
      <div className="smart-finder-copy">
        <div className="eyebrow">Smart adoption finder</div>
        <h3>Describe who would fit your home.</h3>
        <p>Try: “small female dog in Panjim, good with cats and sterilised”. This search runs locally and only reads live listings.</p>
      </div>
      <form className="smart-finder-form" onSubmit={submit}>
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          placeholder="I’m looking for…"
          aria-label="Describe the animal you are looking for"
        />
        <div className="smart-finder-actions">
          <button className="button" type="submit" disabled={!query.trim()}>Find matches</button>
          {(chips.length > 0 || query) && <button className="button button-secondary" type="button" onClick={() => { setQuery(''); onClear() }}>Reset</button>}
        </div>
      </form>
      {chips.length > 0 && <div className="smart-chips" aria-label="Detected preferences">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>}
    </div>
  )
}
