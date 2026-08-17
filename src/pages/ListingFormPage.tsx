import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createAnimalDraft, getAnimal, publishAnimal, removeAnimalPhoto, updateAnimal, uploadAnimalPhotos } from '../lib/api'
import { countryCallingCode, countryOptions, localPhoneNumber } from '../lib/phone'
import type { AgeUnit, Animal, AnimalSize, Sex, Species, YesNoUnknown } from '../types'

const blank = {
  name: '', species: '' as Species, other_species: '', breed: '', sex: 'unknown' as Sex,
  age_value: '', age_unit: 'years' as AgeUnit, size: 'unknown' as AnimalSize,
  city: '', state: 'Goa', country: 'India', description: '', temperament: '',
  sterilised: 'unknown' as YesNoUnknown, vaccinated: 'unknown' as YesNoUnknown, dewormed: 'unknown' as YesNoUnknown,
  good_with_dogs: 'unknown' as YesNoUnknown, good_with_cats: 'unknown' as YesNoUnknown, good_with_children: 'unknown' as YesNoUnknown,
  special_needs: '', medical_notes: '', adoption_requirements: '', contact_name: '', contact_phone: '', whatsapp_ok: true,
}

type FormState = typeof blank
type ImportState = {
  imported?: Record<string, string>
  creativeFile?: File
}

const ynu = <><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></>

export default function ListingFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<FormState>(blank)
  const [existing, setExisting] = useState<Animal | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const previews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files])
  const dialCode = countryCallingCode(form.country)

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews])

  useEffect(() => {
    if (editing) return
    const state = location.state as ImportState | null
    if (!state?.imported) return
    const value = state.imported
    const species = value.species === 'dog' || value.species === 'cat' || value.species === 'other' ? value.species as Species : '' as Species
    const ageUnit = value.age_unit === 'months' || value.age_unit === 'years' ? value.age_unit as AgeUnit : 'years'
    const size = ['small', 'medium', 'large'].includes(value.size) ? value.size as AnimalSize : 'unknown'
    const sex = value.sex === 'male' || value.sex === 'female' ? value.sex as Sex : 'unknown'
    const ynuValue = (input: string | undefined): YesNoUnknown => input === 'yes' || input === 'no' ? input : 'unknown'
    const importedCountry = value.country || 'India'

    setForm({
      name: value.name || '', species, other_species: value.other_species || '', breed: value.breed || '', sex,
      age_value: value.age_value || '', age_unit: ageUnit, size,
      city: value.city || '', state: value.state || '', country: importedCountry, description: value.description || '', temperament: value.temperament || '',
      sterilised: ynuValue(value.sterilised), vaccinated: ynuValue(value.vaccinated), dewormed: ynuValue(value.dewormed),
      good_with_dogs: ynuValue(value.good_with_dogs), good_with_cats: ynuValue(value.good_with_cats), good_with_children: ynuValue(value.good_with_children),
      special_needs: value.special_needs || '', medical_notes: value.medical_notes || '', adoption_requirements: value.adoption_requirements || '',
      contact_name: value.contact_name?.trim() || 'Fosterer', contact_phone: localPhoneNumber(value.contact_phone || '', importedCountry), whatsapp_ok: true,
    })
    if (state.creativeFile instanceof File) setFiles([state.creativeFile])
    window.history.replaceState({}, document.title)
  }, [editing, location.state])

  useEffect(() => {
    if (!id || !user) return
    getAnimal(id).then((animal) => {
      if (!animal || animal.owner_id !== user.id) { setError('You cannot edit this listing.'); return }
      setExisting(animal)
      setForm({
        name: animal.name, species: animal.species, other_species: animal.other_species || '', breed: animal.breed || '', sex: animal.sex,
        age_value: animal.age_value?.toString() || '', age_unit: animal.age_unit || 'years', size: animal.size,
        city: animal.city, state: animal.state || '', country: animal.country, description: animal.description, temperament: animal.temperament || '',
        sterilised: animal.sterilised, vaccinated: animal.vaccinated, dewormed: animal.dewormed,
        good_with_dogs: animal.good_with_dogs, good_with_cats: animal.good_with_cats, good_with_children: animal.good_with_children,
        special_needs: animal.special_needs || '', medical_notes: animal.medical_notes || '', adoption_requirements: animal.adoption_requirements || '',
        contact_name: animal.contact_name, contact_phone: localPhoneNumber(animal.contact_phone, animal.country), whatsapp_ok: animal.whatsapp_ok,
      })
    }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load listing.'))
  }, [id, user])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })) }

  function payload() {
    return {
      name: form.name.trim(), species: form.species, other_species: form.species === 'other' ? form.other_species.trim() || null : null,
      breed: form.breed.trim() || null, sex: form.sex, age_value: form.age_value ? Number(form.age_value) : null, age_unit: form.age_value ? form.age_unit : null,
      size: form.size, city: form.city.trim(), state: form.state.trim() || null, country: form.country.trim(), description: form.description.trim(), temperament: form.temperament.trim() || null,
      sterilised: form.sterilised, vaccinated: form.vaccinated, dewormed: form.dewormed, good_with_dogs: form.good_with_dogs, good_with_cats: form.good_with_cats,
      good_with_children: form.good_with_children, special_needs: form.special_needs.trim() || null, medical_notes: form.medical_notes.trim() || null,
      adoption_requirements: form.adoption_requirements.trim() || null, contact_name: form.contact_name.trim() || 'Fosterer', contact_phone: localPhoneNumber(form.contact_phone, form.country), whatsapp_ok: form.whatsapp_ok,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!editing && files.length === 0) { setError('Add at least one photo before publishing.'); return }
    const totalPhotos = (existing?.animal_photos?.length || 0) + files.length
    if (totalPhotos === 0) { setError('A published listing needs at least one photo.'); return }
    if (totalPhotos > 5) { setError('A listing can have a maximum of 5 photos.'); return }
    setSaving(true); setError('')
    try {
      let animalId = id
      if (editing && id) await updateAnimal(id, payload())
      else {
        const draft = await createAnimalDraft(user.id, payload())
        animalId = draft.id
      }
      if (!animalId) throw new Error('Listing could not be created.')
      if (files.length) await uploadAnimalPhotos(user.id, animalId, files)
      if (!editing || !existing?.is_published) await publishAnimal(animalId)
      navigate('/dashboard')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save listing.') }
    finally { setSaving(false) }
  }

  async function removePhoto(photoId: string, path: string) {
    if (!confirm('Remove this photo?')) return
    try {
      await removeAnimalPhoto(photoId, path)
      setExisting((current) => current ? { ...current, animal_photos: current.animal_photos?.filter((p) => p.id !== photoId) } : current)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove photo.') }
  }

  return (
    <div className="container form-page">
      <Link className="back-link" to="/dashboard">← My animals</Link>
      <div className="form-heading"><div className="eyebrow">{editing ? 'Edit listing' : 'New adoption listing'}</div><h1>{editing ? `Update ${existing?.name || 'animal'}` : 'List an animal for adoption'}</h1><p>Keep information clear, current and honest. Fields marked * are required.</p></div>
      {existing?.moderation_status !== 'active' && editing && <div className="warning-box">This listing is currently {existing?.moderation_status.replace('_', ' ')} and cannot be edited until moderation is complete.</div>}
      <form className="listing-form" onSubmit={handleSubmit}>
        <fieldset disabled={saving || (editing && existing?.moderation_status !== 'active')}>
          <div className="form-section"><h2>About the animal</h2><div className="form-grid three">
            <label><span>Name *</span><input required value={form.name} onChange={(e) => set('name', e.target.value)}/></label>
            <label><span>Species *</span><select required value={form.species} onChange={(e) => set('species', e.target.value as Species)}><option value="" disabled>Select species</option><option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option></select></label>
            {form.species === 'other' ? <label><span>Species name *</span><input required value={form.other_species} onChange={(e) => set('other_species', e.target.value)}/></label> : <label><span>Breed / type</span><input value={form.breed} onChange={(e) => set('breed', e.target.value)} placeholder="e.g. Indie mix"/></label>}
            <label><span>Sex *</span><select value={form.sex} onChange={(e) => set('sex', e.target.value as Sex)}><option value="unknown">Unknown</option><option value="male">Male</option><option value="female">Female</option></select></label>
            <label><span>Approx. age</span><input type="number" min="0" max="600" value={form.age_value} onChange={(e) => set('age_value', e.target.value)}/></label>
            <label><span>Age unit</span><select value={form.age_unit} onChange={(e) => set('age_unit', e.target.value as AgeUnit)}><option value="months">Months</option><option value="years">Years</option></select></label>
            <label><span>Size</span><select value={form.size} onChange={(e) => set('size', e.target.value as AnimalSize)}><option value="unknown">Unknown</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
          </div></div>

          <div className="form-section"><h2>Location</h2><div className="form-grid three"><label><span>City / town *</span><input required value={form.city} onChange={(e) => set('city', e.target.value)}/></label><label><span>State</span><input value={form.state} onChange={(e) => set('state', e.target.value)}/></label><label><span>Country *</span><select required value={form.country} onChange={(e) => set('country', e.target.value)}><option value="" disabled>Select country</option>{countryOptions.map((country) => <option key={country.code} value={country.name}>{country.name}</option>)}</select></label></div></div>

          <div className="form-section"><h2>Story & personality</h2><div className="form-grid"><label className="full"><span>Description *</span><textarea required rows={6} minLength={30} maxLength={2500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Tell adopters who this animal is, how they came into your care, and what kind of home would suit them."/></label><label className="full"><span>Temperament</span><textarea rows={3} value={form.temperament} onChange={(e) => set('temperament', e.target.value)} placeholder="e.g. affectionate, shy at first, playful…"/></label></div></div>

          <div className="form-section"><h2>Health & compatibility</h2><div className="form-grid three"><label><span>Sterilised</span><select value={form.sterilised} onChange={(e) => set('sterilised', e.target.value as YesNoUnknown)}>{ynu}</select></label><label><span>Vaccinated</span><select value={form.vaccinated} onChange={(e) => set('vaccinated', e.target.value as YesNoUnknown)}>{ynu}</select></label><label><span>Dewormed</span><select value={form.dewormed} onChange={(e) => set('dewormed', e.target.value as YesNoUnknown)}>{ynu}</select></label><label><span>Good with dogs</span><select value={form.good_with_dogs} onChange={(e) => set('good_with_dogs', e.target.value as YesNoUnknown)}>{ynu}</select></label><label><span>Good with cats</span><select value={form.good_with_cats} onChange={(e) => set('good_with_cats', e.target.value as YesNoUnknown)}>{ynu}</select></label><label><span>Good with children</span><select value={form.good_with_children} onChange={(e) => set('good_with_children', e.target.value as YesNoUnknown)}>{ynu}</select></label></div><div className="form-grid"><label><span>Special needs</span><textarea rows={3} value={form.special_needs} onChange={(e) => set('special_needs', e.target.value)}/></label><label><span>Medical notes</span><textarea rows={3} value={form.medical_notes} onChange={(e) => set('medical_notes', e.target.value)}/></label><label className="full"><span>Adoption requirements</span><textarea rows={3} value={form.adoption_requirements} onChange={(e) => set('adoption_requirements', e.target.value)}/></label></div></div>

          <div className="form-section"><h2>Photos *</h2><p className="section-help">Add 1–5 clear photos. Imported creatives are automatically cropped to an animal-only image when detection succeeds.</p>
            {existing?.animal_photos && existing.animal_photos.length > 0 && <div className="upload-preview-grid">{existing.animal_photos.map((photo) => <div className="upload-preview" key={photo.id}><img src={photo.public_url} alt=""/><button type="button" onClick={() => removePhoto(photo.id, photo.storage_path)}>Remove</button></div>)}</div>}
            {previews.length > 0 && <div className="upload-preview-grid">{previews.map((item) => <div className="upload-preview" key={item.url}><img src={item.url} alt=""/><span>{item.name}</span></div>)}</div>}
            <label className="file-drop"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}/><strong>Choose photos</strong><span>JPG, PNG or WebP · max 8 MB each · up to 5 files</span></label>
          </div>

          <div className="form-section"><h2>Foster contact</h2><p className="section-help">Enter the local number only. The country code is taken from the listing country for WhatsApp and calls.</p><div className="form-grid two"><label><span>Contact name *</span><input required value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Fosterer"/></label><label><span>Phone number (local) *</span><div className="phone-input-row"><span className="dial-code">{dialCode ? `+${dialCode}` : '+'}</span><input required type="tel" inputMode="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} onBlur={() => set('contact_phone', localPhoneNumber(form.contact_phone, form.country))} placeholder="9876543210"/></div></label><label className="checkbox-label"><input type="checkbox" checked={form.whatsapp_ok} onChange={(e) => set('whatsapp_ok', e.target.checked)}/><span>Allow adopters to contact me on WhatsApp</span></label></div></div>
        </fieldset>
        {error && <div className="error-box">{error}</div>}
        <div className="form-footer"><Link className="button button-secondary" to="/dashboard">Cancel</Link><button className="button" disabled={saving || (editing && existing?.moderation_status !== 'active')}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}</button></div>
      </form>
    </div>
  )
}
