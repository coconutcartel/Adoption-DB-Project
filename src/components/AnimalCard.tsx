import { Link } from 'react-router-dom'
import type { Animal } from '../types'
import { formatAge, formatSpecies, prettyValue } from '../lib/format'

export default function AnimalCard({ animal }: { animal: Animal }) {
  const photo = animal.animal_photos?.[0]?.public_url
  return (
    <article className="animal-card">
      <Link to={`/animals/${animal.id}`} className="animal-card-image-wrap" aria-label={`View ${animal.name}`}>
        {photo ? <img className="animal-card-image" src={photo} alt={animal.animal_photos?.[0]?.alt_text || animal.name} /> : <div className="photo-placeholder">No photo</div>}
        <span className={`status-pill status-${animal.adoption_status}`}>{prettyValue(animal.adoption_status)}</span>
      </Link>
      <div className="animal-card-body">
        <div className="animal-card-heading">
          <div>
            <h2><Link to={`/animals/${animal.id}`}>{animal.name}</Link></h2>
            <p>{formatSpecies(animal)} · {prettyValue(animal.sex)} · {formatAge(animal)}</p>
          </div>
          <span className="location-chip">{animal.city}</span>
        </div>
        <p className="card-description">{animal.description}</p>
        <div className="card-meta">
          <span>{prettyValue(animal.size)}</span>
          <span>Sterilised: {prettyValue(animal.sterilised)}</span>
          <span>Vaccinated: {prettyValue(animal.vaccinated)}</span>
        </div>
        <Link className="text-link" to={`/animals/${animal.id}`}>Meet {animal.name} →</Link>
      </div>
    </article>
  )
}
