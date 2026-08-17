import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getMyAnimals, updateAnimal } from '../lib/api'
import { prettyValue } from '../lib/format'
import type { AdoptionStatus, Animal } from '../types'

export default function DashboardPage() {
  const { user } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    try { setAnimals(await getMyAnimals(user.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load your animals.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [user])

  async function changeStatus(id: string, status: AdoptionStatus) {
    try { await updateAnimal(id, { adoption_status: status }); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update status.') }
  }

  return (
    <div className="container dashboard-page">
      <div className="dashboard-heading"><div><div className="eyebrow">Fosterer dashboard</div><h1>My animals</h1><p>Keep every listing current. Status changes update the public gallery automatically.</p></div><Link className="button" to="/dashboard/new">+ List an animal</Link></div>
      {error && <div className="error-box">{error}</div>}
      {loading ? <div className="page-loading">Loading your listings…</div> : animals.length === 0 ? (
        <div className="empty-state dashboard-empty"><div className="empty-icon">♥</div><h2>No animals listed yet</h2><p>Create your first adoption listing.</p><Link className="button" to="/dashboard/new">List an animal</Link></div>
      ) : (
        <div className="dashboard-list">
          {animals.map((animal) => {
            const photo = animal.animal_photos?.[0]?.public_url
            return <article className="dashboard-item" key={animal.id}>
              <div className="dashboard-thumb">{photo ? <img src={photo} alt=""/> : <span>No photo</span>}</div>
              <div className="dashboard-info"><div className="dashboard-title-line"><h2>{animal.name}</h2><span className={`status-pill status-${animal.adoption_status}`}>{prettyValue(animal.adoption_status)}</span>{animal.moderation_status !== 'active' && <span className="moderation-pill">{prettyValue(animal.moderation_status)}</span>}</div><p>{animal.city} · Updated {new Date(animal.updated_at).toLocaleDateString()}</p>{!animal.is_published && <div className="draft-note">Draft — not visible publicly</div>}</div>
              <div className="dashboard-actions">
                <Link className="button button-secondary button-small" to={`/dashboard/edit/${animal.id}`}>Edit</Link>
                {animal.moderation_status === 'active' && <select aria-label={`Change ${animal.name} status`} value={animal.adoption_status} onChange={(e) => changeStatus(animal.id, e.target.value as AdoptionStatus)}><option value="available">Available</option><option value="reserved">Reserved</option><option value="adopted">Adopted</option><option value="withdrawn">Withdrawn</option></select>}
              </div>
            </article>
          })}
        </div>
      )}
    </div>
  )
}
