import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AnimalCard from '../components/AnimalCard'
import FilterBar from '../components/FilterBar'
import SmartFinder from '../components/SmartFinder'
import { getPublicAnimals } from '../lib/api'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Animal, AnimalFilters } from '../types'

const emptyFilters: AnimalFilters = { search: '', species: '', sex: '', size: '', city: '' }

export default function GalleryPage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [filters, setFilters] = useState<AnimalFilters>(emptyFilters)
  const [loading, setLoading] = useState(true)
  const [smartChips, setSmartChips] = useState<string[]>([])
  const [error, setError] = useState('')

  const loadAnimals = useCallback(async () => {
    setLoading(true); setError('')
    try { setAnimals(await getPublicAnimals(filters)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load animals.') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(loadAnimals, 220)
    return () => clearTimeout(timer)
  }, [loadAnimals])

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return
    const channel = supabase
      .channel('public-listing-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'public_listing_events' }, () => loadAnimals())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadAnimals])

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Community adoption database</div>
            <h1>Find your next family member.</h1>
            <p>Browse animals currently looking for safe, loving homes. Listings are maintained by the people caring for them.</p>
            <div className="hero-actions"><a className="button" href="#gallery">Browse animals</a><Link className="button button-secondary" to="/dashboard/new">List an animal</Link></div>
          </div>
          <div className="hero-card" aria-hidden="true">
            <div className="hero-card-top"><span className="pulse-dot"/> Live listings</div>
            <div className="hero-card-number">{animals.length}</div>
            <div className="hero-card-label">matching animals right now</div>
            <div className="hero-card-rule"/>
            <p>When fosterers update a listing, the gallery refreshes automatically.</p>
          </div>
        </div>
      </section>

      <section className="gallery-section" id="gallery">
        <div className="container">
          <div className="section-heading"><div><div className="eyebrow">Available for adoption</div><h2>Meet the animals</h2></div><p>Use the smart finder or filters to narrow your search.</p></div>
          <SmartFinder
            chips={smartChips}
            onApply={(next, chips) => { setSmartChips(chips); setFilters({ ...emptyFilters, ...next }) }}
            onClear={() => { setSmartChips([]); setFilters(emptyFilters) }}
          />
          <FilterBar filters={filters} onChange={(next) => { setSmartChips([]); setFilters(next) }} onClear={() => { setSmartChips([]); setFilters(emptyFilters) }} />
          {error && <div className="error-box">{error}</div>}
          {loading ? <div className="card-grid skeleton-grid">{[1,2,3,4].map((n) => <div className="skeleton-card" key={n}/>)}</div> : animals.length > 0 ? (
            <div className="card-grid">{animals.map((animal) => <AnimalCard key={animal.id} animal={animal}/>)}</div>
          ) : (
            <div className="empty-state"><div className="empty-icon">⌕</div><h3>No animals match those filters</h3><p>Try clearing one or more filters.</p><button className="button button-secondary" onClick={() => setFilters(emptyFilters)}>Clear filters</button></div>
          )}
        </div>
      </section>
    </>
  )
}
