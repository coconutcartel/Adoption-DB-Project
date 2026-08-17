import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ReportModal from '../components/ReportModal'
import { useAuth } from '../contexts/AuthContext'
import { formatAge, formatSpecies, prettyValue, shareUrl, whatsappLink } from '../lib/format'
import { getAnimal } from '../lib/api'
import type { Animal } from '../types'

export default function AnimalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    getAnimal(id).then(setAnimal).catch((err) => setError(err instanceof Error ? err.message : 'Could not load listing.')).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const state = location.state as { reportAfterLogin?: boolean } | null
    if (state?.reportAfterLogin && user && animal && user.id !== animal.owner_id) {
      setReportOpen(true)
      window.history.replaceState({}, document.title)
    }
  }, [location.state, user, animal])

  if (loading) return <div className="container page-loading">Loading animal…</div>
  if (error || !animal) return <div className="container not-found"><h1>Listing unavailable</h1><p>{error || 'This animal may have been adopted, withdrawn or removed.'}</p><Link className="button" to="/">Back to gallery</Link></div>

  const photos = animal.animal_photos ?? []
  const mainPhoto = photos[photoIndex]?.public_url
  const isOwner = user?.id === animal.owner_id
  const animalId = animal.id
  const animalName = animal.name

  function openReport() {
    if (!user) {
      navigate('/login', { state: { from: `/animals/${animalId}`, reportAfterLogin: true } })
      return
    }
    setReportOpen(true)
  }

  async function shareListing() {
    const url = shareUrl(animalId)
    try {
      if (navigator.share) {
        await navigator.share({ title: `${animalName} is looking for a home`, text: `Meet ${animalName} on Rehome.`, url })
      } else {
        await navigator.clipboard.writeText(url)
        alert('Listing link copied.')
      }
    } catch {
      // The native share sheet can be dismissed without sharing.
    }
  }

  return (
    <div className="container animal-detail-page">
      <Link className="back-link" to="/">← Back to animals</Link>
      <div className="animal-detail-grid">
        <section>
          <div className="detail-main-photo">{mainPhoto ? <img src={mainPhoto} alt={photos[photoIndex]?.alt_text || animal.name}/> : <div className="photo-placeholder">No photo</div>}<span className={`status-pill status-${animal.adoption_status}`}>{prettyValue(animal.adoption_status)}</span></div>
          {photos.length > 1 && <div className="thumbnail-row">{photos.map((photo, index) => <button key={photo.id} className={index === photoIndex ? 'thumbnail active' : 'thumbnail'} onClick={() => setPhotoIndex(index)}><img src={photo.public_url} alt=""/></button>)}</div>}
        </section>
        <section className="detail-content">
          <div className="eyebrow">{animal.city}{animal.state ? `, ${animal.state}` : ''}</div>
          <h1>{animal.name}</h1>
          <p className="detail-subtitle">{formatSpecies(animal)} · {animal.breed || 'Breed unknown'} · {prettyValue(animal.sex)} · {formatAge(animal)}</p>
          <p className="detail-description">{animal.description}</p>

          <div className="fact-grid">
            <div><span>Size</span><strong>{prettyValue(animal.size)}</strong></div>
            <div><span>Sterilised</span><strong>{prettyValue(animal.sterilised)}</strong></div>
            <div><span>Vaccinated</span><strong>{prettyValue(animal.vaccinated)}</strong></div>
            <div><span>Dewormed</span><strong>{prettyValue(animal.dewormed)}</strong></div>
            <div><span>With dogs</span><strong>{prettyValue(animal.good_with_dogs)}</strong></div>
            <div><span>With cats</span><strong>{prettyValue(animal.good_with_cats)}</strong></div>
            <div><span>With children</span><strong>{prettyValue(animal.good_with_children)}</strong></div>
          </div>

          {animal.temperament && <div className="detail-section"><h3>Personality</h3><p>{animal.temperament}</p></div>}
          {animal.special_needs && <div className="detail-section"><h3>Special needs</h3><p>{animal.special_needs}</p></div>}
          {animal.medical_notes && <div className="detail-section"><h3>Medical notes</h3><p>{animal.medical_notes}</p></div>}
          {animal.adoption_requirements && <div className="detail-section"><h3>Adoption requirements</h3><p>{animal.adoption_requirements}</p></div>}

          <div className="contact-card">
            <div><span className="eyebrow">Foster contact</span><h3>{animal.contact_name}</h3><p>{animal.contact_phone}</p></div>
            <div className="contact-actions">
              {animal.whatsapp_ok && <a className="button" target="_blank" rel="noreferrer" href={whatsappLink(animal.contact_phone, animal.name, animal.id)}>WhatsApp</a>}
              <a className="button button-secondary" href={`tel:${animal.contact_phone}`}>Call</a>
              <button className="button button-secondary" type="button" onClick={shareListing}>Share</button>
            </div>
          </div>

          <div className="listing-safety-row">
            <span>Something wrong with this listing?</span>
            {!isOwner && <button className="text-button danger-text" onClick={openReport}>Report listing</button>}
            {isOwner && <Link className="text-link" to={`/dashboard/edit/${animal.id}`}>Edit your listing</Link>}
          </div>
        </section>
      </div>
      {reportOpen && user && <ReportModal animalId={animal.id} animalName={animal.name} reporterId={user.id} onClose={() => setReportOpen(false)} />}
    </div>
  )
}
