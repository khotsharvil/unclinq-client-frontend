import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { therapistAPI, sessionsAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Button, Spinner, StatusPill } from '../../components/ui'

const STAGES = ['uploaded', 'transcribing', 'transcribed', 'understanding', 'ready']
const PROCESSING = new Set(['uploaded', 'transcribing', 'transcribed', 'understanding'])

export default function Upload() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [file, setFile] = useState(null)
  const [occurredAt, setOccurredAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [sessionId, setSessionId] = useState(null)
  const [status, setStatus] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    therapistAPI
      .clients()
      .then((res) => setClients(res.data.clients || []))
      .catch(() => setClients([]))
  }, [])

  useEffect(() => {
    if (!sessionId) return
    if (status && !PROCESSING.has(status)) return
    pollRef.current = setTimeout(async () => {
      try {
        const res = await sessionsAPI.get(sessionId)
        setStatus(res.data.session?.status || null)
      } catch {
        /* keep last known */
      }
    }, 4000)
    return () => clearTimeout(pollRef.current)
  }, [sessionId, status])

  async function upload(e) {
    e.preventDefault()
    if (!file) return setError('Choose an audio file first.')
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('audio', file)
      if (clientId) fd.append('client_id', clientId)
      if (occurredAt) fd.append('occurred_at', occurredAt)
      // Do NOT set Content-Type; axios sets the multipart boundary.
      const res = await sessionsAPI.upload(fd)
      setSessionId(res.data.id)
      setStatus(res.data.status || 'uploaded')
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    clearTimeout(pollRef.current)
    setSessionId(null)
    setStatus(null)
    setFile(null)
    setOccurredAt('')
  }

  const currentStage = STAGES.indexOf(status)

  return (
    <AppShell theme="therapist">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Upload a session</h1>
      <p className="uc-secondary mb-5">Transcribe and understand a recorded session.</p>

      <div className="max-w-lg">
        {!sessionId ? (
          <Card>
            <form onSubmit={upload} className="space-y-4">
              <label className="block">
                <span className="uc-label">Client</span>
                <select
                  className="uc-input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {clients.map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {c.name || c.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="uc-label">Audio file</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="uc-input"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <label className="block">
                <span className="uc-label">Session date (optional)</span>
                <input
                  type="datetime-local"
                  className="uc-input"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </label>

              {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
              <Button variant="primary" className="uc-btn--block" disabled={uploading || !file}>
                {uploading ? <Spinner size={16} /> : 'Upload & process'}
              </Button>
            </form>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <span className="uc-label">Processing</span>
              <StatusPill status={status} />
            </div>

            <ol className="space-y-2">
              {STAGES.map((stage, i) => {
                const done = currentStage > i
                const active = currentStage === i
                return (
                  <li key={stage} className="flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0"
                      style={{
                        background: done || active ? 'var(--accent)' : 'var(--surface-alt)',
                        color: done || active ? '#fff' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span
                      className="text-sm capitalize"
                      style={{ color: active ? 'var(--text)' : 'var(--text-secondary)', fontWeight: active ? 700 : 400 }}
                    >
                      {stage.replace(/_/g, ' ')}
                    </span>
                    {active && PROCESSING.has(status) && <Spinner size={14} className="ml-1" />}
                  </li>
                )
              })}
            </ol>

            {status === 'ready' && (
              <div className="mt-4">
                <Button to={`/t/sessions/${sessionId}`} variant="primary" className="uc-btn--block">
                  Open session
                </Button>
              </div>
            )}
            {status === 'failed' && (
              <p className="mt-3 text-sm" style={{ color: '#B0332F' }}>
                Processing failed. Open the session to retry.
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Link to={`/t/sessions/${sessionId}`} className="uc-btn uc-btn--secondary uc-btn--sm">
                View session
              </Link>
              <button className="uc-btn uc-btn--ghost uc-btn--sm" onClick={reset}>
                Upload another
              </button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
