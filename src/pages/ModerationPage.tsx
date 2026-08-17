import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReports, moderateAnimal, updateReportStatus } from '../lib/api'
import { prettyValue } from '../lib/format'
import type { ListingReport, ReportStatus } from '../types'

export default function ModerationPage() {
  const [reports, setReports] = useState<ListingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try { setReports(await getReports()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load reports.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function setReport(report: ListingReport, status: ReportStatus) {
    try { await updateReportStatus(report.id, status, notes[report.id]); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update report.') }
  }

  async function setListing(report: ListingReport, status: 'active' | 'under_review' | 'hidden') {
    if (!report.animal) return
    try { await moderateAnimal(report.animal.id, status); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not moderate listing.') }
  }

  return (
    <div className="container moderation-page">
      <div className="dashboard-heading"><div><div className="eyebrow">Moderator tools</div><h1>Listing reports</h1><p>Reporter identities are private. Review the evidence and act on the listing, not the person reporting it.</p></div></div>
      {error && <div className="error-box">{error}</div>}
      {loading ? <div className="page-loading">Loading reports…</div> : reports.length === 0 ? <div className="empty-state"><h2>No reports</h2><p>The queue is clear.</p></div> : <div className="report-list">{reports.map((report) => <article className="report-card" key={report.id}>
        <div className="report-top"><div><span className={`report-status report-${report.status}`}>{prettyValue(report.status)}</span><h2>{report.animal?.name || 'Unavailable listing'}</h2><p>{prettyValue(report.reason)} · Reported {new Date(report.created_at).toLocaleString()}</p></div>{report.animal && <Link className="text-link" to={`/animals/${report.animal.id}`}>Open listing →</Link>}</div>
        {report.details && <blockquote>{report.details}</blockquote>}
        {report.animal && <div className="moderation-summary"><span>Listing: <strong>{prettyValue(report.animal.moderation_status)}</strong></span><span>Adoption: <strong>{prettyValue(report.animal.adoption_status)}</strong></span></div>}
        <label><span>Moderator notes</span><textarea rows={2} value={notes[report.id] ?? report.moderator_notes ?? ''} onChange={(e) => setNotes((current) => ({ ...current, [report.id]: e.target.value }))}/></label>
        <div className="moderation-actions"><div><button className="button button-secondary button-small" onClick={() => setReport(report, 'reviewing')}>Mark reviewing</button><button className="button button-secondary button-small" onClick={() => setReport(report, 'dismissed')}>Dismiss</button><button className="button button-small" onClick={() => setReport(report, 'resolved')}>Resolve</button></div>{report.animal && <div><button className="button button-secondary button-small" onClick={() => setListing(report, 'under_review')}>Pause listing</button><button className="button button-danger button-small" onClick={() => setListing(report, 'hidden')}>Hide listing</button><button className="button button-secondary button-small" onClick={() => setListing(report, 'active')}>Restore</button></div>}</div>
      </article>)}</div>}
    </div>
  )
}
