import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ExtractedListing {
  name: string
  species: 'dog' | 'cat' | 'other' | 'unknown'
  other_species: string
  breed: string
  sex: 'male' | 'female' | 'unknown'
  age_value: string
  age_unit: 'months' | 'years' | 'unknown'
  size: 'small' | 'medium' | 'large' | 'unknown'
  city: string
  state: string
  country: string
  description: string
  temperament: string
  sterilised: 'yes' | 'no' | 'unknown'
  vaccinated: 'yes' | 'no' | 'unknown'
  dewormed: 'yes' | 'no' | 'unknown'
  good_with_dogs: 'yes' | 'no' | 'unknown'
  good_with_cats: 'yes' | 'no' | 'unknown'
  good_with_children: 'yes' | 'no' | 'unknown'
  special_needs: string
  medical_notes: string
  adoption_requirements: string
  contact_name: string
  contact_phone: string
}

interface CropBox {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

type ExtractionResponse = {
  data?: ExtractedListing
  crop?: CropBox | null
  generated?: { name?: boolean; contact_name?: boolean }
  error?: string
}

async function cropAnimalPhoto(file: File, crop: CropBox) {
  const bitmap = await createImageBitmap(file)
  try {
    const maxCoordinate = Math.max(crop.xmin, crop.ymin, crop.xmax, crop.ymax)
    const normalised = maxCoordinate <= 1.5
    let left = normalised ? crop.xmin * bitmap.width : crop.xmin
    let top = normalised ? crop.ymin * bitmap.height : crop.ymin
    let right = normalised ? crop.xmax * bitmap.width : crop.xmax
    let bottom = normalised ? crop.ymax * bitmap.height : crop.ymax

    const width = Math.max(1, right - left)
    const height = Math.max(1, bottom - top)
    const padding = Math.max(width, height) * 0.12
    left = Math.max(0, left - padding)
    top = Math.max(0, top - padding)
    right = Math.min(bitmap.width, right + padding)
    bottom = Math.min(bitmap.height, bottom + padding)

    const sourceWidth = Math.max(1, right - left)
    const sourceHeight = Math.max(1, bottom - top)
    const outputScale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth * outputScale))
    canvas.height = Math.max(1, Math.round(sourceHeight * outputScale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the animal crop.')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, left, top, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the cropped animal photo.')), 'image/jpeg', 0.92)
    })
    return new File([blob], `animal-${Date.now()}.jpg`, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

export default function ImportCreativePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [listingFile, setListingFile] = useState<File | null>(null)
  const [data, setData] = useState<ExtractedListing | null>(null)
  const [generated, setGenerated] = useState<{ name?: boolean; contact_name?: boolean }>({})
  const [cropMessage, setCropMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo(() => file ? URL.createObjectURL(file) : '', [file])
  const listingPreview = useMemo(() => listingFile ? URL.createObjectURL(listingFile) : '', [listingFile])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => () => { if (listingPreview) URL.revokeObjectURL(listingPreview) }, [listingPreview])

  async function extract() {
    if (!file || !session?.access_token) return
    setBusy(true)
    setError('')
    setData(null)
    setListingFile(null)
    setGenerated({})
    setCropMessage('')
    try {
      const body = new FormData()
      body.append('creative', file)
      const response = await fetch('/api/extract-creative', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })

      const responseText = await response.text()
      let result: ExtractionResponse = {}

      if (responseText.trim()) {
        try {
          result = JSON.parse(responseText) as ExtractionResponse
        } catch {
          throw new Error(`Extraction service returned an unreadable response (HTTP ${response.status}). Please try again.`)
        }
      } else {
        throw new Error(`Extraction service returned an empty response (HTTP ${response.status}). Please try again.`)
      }

      if (!response.ok || !result.data) {
        throw new Error(result.error || 'Could not extract listing information.')
      }

      setData(result.data)
      setGenerated(result.generated || {})

      if (result.crop) {
        try {
          const cropped = await cropAnimalPhoto(file, result.crop)
          setListingFile(cropped)
          setCropMessage('Animal-only listing photo prepared automatically.')
        } catch {
          setListingFile(file)
          setCropMessage('The animal was detected, but the browser could not create the crop. The original creative is attached for review.')
        }
      } else {
        setListingFile(file)
        setCropMessage('The animal could not be isolated confidently. The original creative is attached; replace it with a clean animal photo before publishing if needed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract listing information.')
    } finally {
      setBusy(false)
    }
  }

  function continueToListing() {
    if (!file || !data) return
    navigate('/dashboard/new', { state: { imported: data, creativeFile: listingFile || file } })
  }

  return (
    <div className="container form-page">
      <Link className="back-link" to="/dashboard">← My animals</Link>
      <div className="form-heading">
        <div className="eyebrow">Admin tools</div>
        <h1>Import adoption creative</h1>
        <p>Upload a JPG, PNG or WebP poster. Cloudflare AI extracts the stated information, suggests safe defaults for missing names, and prepares an animal-only listing photo when detection succeeds.</p>
      </div>

      <div className="form-section">
        <h2>1. Upload creative</h2>
        {preview && <div className="upload-preview-grid"><div className="upload-preview"><img src={preview} alt="Creative preview"/><span>{file?.name}</span></div></div>}
        <label className="file-drop">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setFile(e.target.files?.[0] || null); setListingFile(null); setData(null); setGenerated({}); setCropMessage(''); setError('') }}/>
          <strong>Choose creative</strong>
          <span>JPG, PNG or WebP · max 8 MB</span>
        </label>
        <div className="form-footer"><button className="button" type="button" disabled={!file || busy} onClick={extract}>{busy ? 'Reading creative…' : 'Extract information'}</button></div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {data && (
        <div className="form-section">
          <h2>2. Review extraction</h2>
          <p className="section-help">The listing form is still the final review step. Suggested/default values are identified below so they are not confused with facts printed on the creative.</p>
          <div className="fact-grid">
            <div><span>Name</span><strong>{data.name || 'Not found'}</strong>{generated.name && <small className="generated-note">Suggested name</small>}</div>
            <div><span>Species</span><strong>{data.species}</strong></div>
            <div><span>Sex</span><strong>{data.sex}</strong></div>
            <div><span>Age</span><strong>{data.age_value ? `${data.age_value} ${data.age_unit}` : 'Not found'}</strong></div>
            <div><span>Location</span><strong>{[data.city, data.state].filter(Boolean).join(', ') || 'Not found'}</strong></div>
            <div><span>Foster contact</span><strong>{data.contact_name || 'Fosterer'}</strong>{generated.contact_name && <small className="generated-note">Default value</small>}</div>
          </div>
          {data.description && <div className="detail-section"><h3>Extracted description</h3><p>{data.description}</p></div>}
          {listingPreview && <div className="detail-section"><h3>Listing photo</h3><div className="upload-preview-grid"><div className="upload-preview"><img src={listingPreview} alt="Prepared listing photo"/><span>{cropMessage}</span></div></div></div>}
          <div className="form-footer">
            <button className="button button-secondary" type="button" onClick={() => { setData(null); setListingFile(null); setGenerated({}); setCropMessage('') }}>Scan again</button>
            <button className="button" type="button" onClick={continueToListing}>Continue to listing form →</button>
          </div>
        </div>
      )}
    </div>
  )
}
