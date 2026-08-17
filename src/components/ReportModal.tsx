import { useState } from 'react'
import type { ReportReason } from '../types'
import { submitReport } from '../lib/api'

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'already_adopted', label: 'Animal appears to already be adopted' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'misleading', label: 'Misleading or inaccurate information' },
  { value: 'scam', label: 'Possible scam or suspicious activity' },
  { value: 'animal_safety', label: 'Animal safety or welfare concern' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
]

export default function ReportModal({ animalId, animalName, reporterId, onClose }: {
  animalId: string
  animalName: string
  reporterId: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReason>('already_adopted')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await submitReport(animalId, reporterId, reason, details)
      setSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not submit report.'
      setError(message.includes('one_open_report_per_user') ? 'You already have an open report for this listing.' : message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="report-title" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {success ? (
          <div className="success-state"><div className="success-icon">✓</div><h2 id="report-title">Report received</h2><p>Thank you. A moderator can now review the listing for {animalName}. The fosterer will not see who submitted the report.</p><button className="button" onClick={onClose}>Done</button></div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="eyebrow">Community safety</div>
            <h2 id="report-title">Report {animalName}'s listing</h2>
            <p className="muted">Reports are private and visible only to moderators. Please report genuine concerns rather than adoption preferences.</p>
            <label><span>Reason</span><select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>Additional details <small>(optional)</small></span><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={5} maxLength={1200} placeholder="Tell the moderator what you noticed…" /></label>
            {error && <div className="error-box">{error}</div>}
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-danger" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</button></div>
          </form>
        )}
      </div>
    </div>
  )
}
