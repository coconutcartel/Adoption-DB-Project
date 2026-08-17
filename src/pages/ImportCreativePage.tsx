import { useMemo, useState } from 'react'
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

type ExtractionResponse = { data?: ExtractedListing; error?: string }

export default function ImportCreativePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<ExtractedListing | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo(() => file ? URL.createObjectURL(file) : '', [file])

  async function extract() {
    if (!file || !session?.access_token) return
    setBusy(true)
    setError('')
    setData(null)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract listing information.')
    } finally {
      setBusy(false)
    }
  }

  function continueToListing() {
    if (!file || !data) return
    navigate('/dashboard/new', { state: { imported: data, creativeFile: file } })
  }

  return (
    <div className="container form-page">
      <Link className="back-link" to="/dashboard">← My animals</Link>
      <div className="form-heading">
        <div className="eyebrow">Admin tools</div>
        <h1>Import adoption creative</h1>
        <p>Upload a JPG, PNG or WebP poster. Cloudflare AI will extract only information stated in the creative. You will review everything before a new listing is created.</p>
      </div>

      <div className="form-section">
        <h2>1. Upload creative</h2>
        {preview && <div className="upload-preview-grid"><div className="upload-preview"><img src={preview} alt="Creative preview"/><span>{file?.name}</span></div></div>}
        <label className="file-drop">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setFile(e.target.files?.[0] || null); setData(null); setError('') }}/>
          <strong>Choose creative</strong>
          <span>JPG, PNG or WebP · max 8 MB</span>
        </label>
        <div className="form-footer"><button className="button" type="button" disabled={!file || busy} onClick={extract}>{busy ? 'Reading creative…' : 'Extract information'}</button></div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {data && (
        <div className="form-section">
          <h2>2. Review extraction</h2>
          <p className="section-help">Unknown or missing facts are intentionally left blank or marked Unknown. The normal listing form is the final review step.</p>
          <div className="fact-grid">
            <div><span>Name</span><strong>{data.name || 'Not found'}</strong></div>
            <div><span>Species</span><strong>{data.species}</strong></div>
            <div><span>Sex</span><strong>{data.sex}</strong></div>
            <div><span>Age</span><strong>{data.age_value ? `${data.age_value} ${data.age_unit}` : 'Not found'}</strong></div>
            <div><span>Location</span><strong>{[data.city, data.state].filter(Boolean).join(', ') || 'Not found'}</strong></div>
            <div><span>Contact</span><strong>{data.contact_phone || data.contact_name || 'Not found'}</strong></div>
          </div>
          {data.description && <div className="detail-section"><h3>Extracted description</h3><p>{data.description}</p></div>}
          <div className="form-footer">
            <button className="button button-secondary" type="button" onClick={() => setData(null)}>Scan again</button>
            <button className="button" type="button" onClick={continueToListing}>Continue to listing form →</button>
          </div>
        </div>
      )}
    </div>
  )
}
