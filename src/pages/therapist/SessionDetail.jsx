import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sessionsAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Button, Spinner, StatusPill, ProvenanceBadge, formatDate } from '../../components/ui'

const PROCESSING = new Set(['uploaded', 'transcribing', 'transcribed', 'understanding'])

const KIND_LABELS = {
  client_concern: 'Client concerns',
  theme: 'Themes',
  goal: 'Goals',
  intervention: 'Interventions',
  therapist_guidance: 'Therapist guidance',
  agreed_action: 'Agreed actions',
}

function ms(t) {
  if (t == null) return ''
  const s = Math.floor(t / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function SessionDetail() {
  const { sessionId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const pollRef = useRef(null)

  function load() {
    return sessionsAPI
      .get(sessionId)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    return () => clearTimeout(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Auto-poll while the session is still processing.
  useEffect(() => {
    const status = data?.session?.status
    if (status && PROCESSING.has(status)) {
      pollRef.current = setTimeout(load, 4000)
    }
    return () => clearTimeout(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session?.status])

  async function swap() {
    setBusy('swap')
    try {
      await sessionsAPI.swapSpeakers(sessionId)
      await load()
    } finally {
      setBusy('')
    }
  }

  async function reprocess() {
    setBusy('reprocess')
    try {
      await sessionsAPI.reprocess(sessionId)
      await load()
    } finally {
      setBusy('')
    }
  }

  async function correctSpeaker(seq, speaker) {
    // optimistic
    setData((d) => ({ ...d, transcript: d.transcript.map((l) => (l.seq === seq ? { ...l, speaker } : l)) }))
    try { await sessionsAPI.correctSpeaker(sessionId, seq, speaker) } catch { await load() }
  }

  async function removeMemory(memId) {
    setData((d) => ({ ...d, memory: d.memory.filter((m) => m.id !== memId) }))
    try { await sessionsAPI.editMemory(sessionId, memId, { active: false }) } catch { await load() }
  }

  async function confirmMemory(memId) {
    setData((d) => ({ ...d, memory: d.memory.map((m) => (m.id === memId ? { ...m, confirmed_by_therapist: true } : m)) }))
    try { await sessionsAPI.editMemory(sessionId, memId, { confirmed: true }) } catch { await load() }
  }

  async function saveSummary() {
    setBusy('summary')
    try {
      await sessionsAPI.editSummary(sessionId, summaryDraft.trim())
      setData((d) => ({ ...d, session: { ...d.session, session_summary: summaryDraft.trim() } }))
      setEditingSummary(false)
    } finally { setBusy('') }
  }

  async function approve() {
    setBusy('approve')
    try {
      await sessionsAPI.approveSummary(sessionId)
      await load()
    } finally { setBusy('') }
  }

  async function exportSession() {
    setBusy('export')
    try {
      const res = await sessionsAPI.export(sessionId)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId.slice(0, 8)}.json`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } finally { setBusy('') }
  }

  if (loading) {
    return (
      <AppShell theme="therapist">
        <div className="py-16 flex justify-center"><Spinner size={26} /></div>
      </AppShell>
    )
  }

  if (!data?.session) {
    return (
      <AppShell theme="therapist">
        <Card><p className="uc-secondary text-sm">This session could not be found.</p></Card>
      </AppShell>
    )
  }

  const { session, transcript = [], memory = [], exercises = [] } = data
  const isProcessing = PROCESSING.has(session.status)
  const isFailed = session.status === 'failed'
  const isDraft = session.status === 'ready' && session.summary_status === 'draft'

  // Group memory by kind.
  const grouped = {}
  for (const m of memory) (grouped[m.kind] || (grouped[m.kind] = [])).push(m)

  return (
    <AppShell theme="therapist">
      <Link to={session.client_id ? `/t/clients/${session.client_id}` : '/t'} className="uc-navlink mb-3 inline-flex">
        ← Back to client
      </Link>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session</h1>
          <p className="uc-muted text-sm">{formatDate(session.occurred_at)}</p>
        </div>
        <StatusPill status={session.status} />
      </div>

      {isProcessing && (
        <Card className="mb-5">
          <div className="flex items-center gap-3">
            <Spinner size={20} />
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Processing…</p>
              <p className="uc-muted text-sm capitalize">{session.status.replace(/_/g, ' ')}</p>
            </div>
            <Button variant="secondary" className="uc-btn--sm ml-auto" onClick={load}>
              Refresh
            </Button>
          </div>
        </Card>
      )}

      {isFailed && (
        <Card className="mb-5">
          <p className="font-semibold" style={{ color: '#B0332F' }}>Processing failed</p>
          {session.error && <p className="uc-secondary text-sm mt-1">{session.error}</p>}
          <div className="mt-3">
            <Button variant="secondary" className="uc-btn--sm" onClick={reprocess} disabled={busy === 'reprocess'}>
              {busy === 'reprocess' ? <Spinner size={14} /> : 'Retry processing'}
            </Button>
          </div>
        </Card>
      )}

      {/* Approval gate: AI-extracted understanding is a DRAFT until the therapist approves it. */}
      {isDraft && (
        <Card className="mb-5" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Draft — review before it becomes context</p>
          <p className="uc-secondary text-sm mt-1">
            Nothing below is shared with the client or added to the therapy journey yet. Review the summary and
            understanding, remove anything wrong, then approve. Approving activates this as durable context and
            releases any drafted actions to the client.
          </p>
          <div className="mt-3">
            <Button variant="primary" className="uc-btn--sm" onClick={approve} disabled={busy === 'approve'}>
              {busy === 'approve' ? <Spinner size={14} /> : 'Approve & add to journey'}
            </Button>
          </div>
        </Card>
      )}
      {session.status === 'ready' && session.summary_status === 'approved' && (
        <p className="uc-muted text-xs mb-4">✓ Approved — part of the client's therapy context.</p>
      )}

      {/* Low-confidence speaker nudge */}
      {!isProcessing && session.speaker_verify_suggested && (
        <Card className="mb-5" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            <strong>Please verify the speakers.</strong> Automatic therapist/client detection was
            uncertain for this session{session.speaker_confidence != null ? ` (${Math.round(session.speaker_confidence * 100)}% confidence)` : ''}.
            Use “Swap speakers” or fix individual lines below if a label looks wrong.
          </p>
        </Card>
      )}

      {(session.session_summary || editingSummary) && (
        <Card className="mb-5">
          <div className="flex items-center justify-between">
            <span className="uc-label">Summary</span>
            {!isProcessing && !editingSummary && (
              <button className="uc-navlink text-xs" onClick={() => { setSummaryDraft(session.session_summary || ''); setEditingSummary(true) }}>Edit</button>
            )}
          </div>
          {editingSummary ? (
            <div className="mt-2 space-y-2">
              <textarea className="uc-input uc-textarea" rows={4} value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} maxLength={2000} />
              <div className="flex gap-2">
                <Button variant="primary" className="uc-btn--sm" onClick={saveSummary} disabled={busy === 'summary'}>
                  {busy === 'summary' ? <Spinner size={14} /> : 'Save'}
                </Button>
                <button className="uc-btn uc-btn--ghost uc-btn--sm" onClick={() => setEditingSummary(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{session.session_summary}</p>
              <p className="uc-muted text-xs mt-2">From session recording</p>
            </>
          )}
        </Card>
      )}

      {/* Controls */}
      {!isProcessing && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <Button variant="secondary" className="uc-btn--sm" onClick={swap} disabled={busy === 'swap'}>
            {busy === 'swap' ? <Spinner size={14} /> : 'Swap speakers'}
          </Button>
          <Button variant="secondary" className="uc-btn--sm" onClick={reprocess} disabled={busy === 'reprocess'}>
            {busy === 'reprocess' ? <Spinner size={14} /> : 'Reprocess'}
          </Button>
          {!session.session_summary && !editingSummary && (
            <Button variant="secondary" className="uc-btn--sm" onClick={() => { setSummaryDraft(''); setEditingSummary(true) }}>
              Add summary
            </Button>
          )}
          <Button variant="secondary" className="uc-btn--sm" onClick={exportSession} disabled={busy === 'export'}>
            {busy === 'export' ? <Spinner size={14} /> : 'Export'}
          </Button>
        </div>
      )}

      {/* Session summary — structured, from the extracted understanding (only kinds present show). */}
      {memory.length > 0 && (
        <div className="mb-6">
          <span className="uc-label">Session summary</span>
          <div className="grid gap-4 md:grid-cols-2 mt-2">
            {Object.keys(grouped).map((kind) => (
              <Card key={kind}>
                <span className="uc-label">{KIND_LABELS[kind] || kind}</span>
                <ul className="mt-2 space-y-2">
                  {grouped[kind].map((m) => {
                    const isAI = m.provenance === 'ai_generated'
                    return (
                      <li key={m.id}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm" style={{ color: 'var(--text)' }}>{m.content}</span>
                          <button
                            className="uc-muted text-xs opacity-60 hover:opacity-100 shrink-0"
                            title="Remove from understanding"
                            onClick={() => removeMemory(m.id)}
                          >✕</button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <ProvenanceBadge provenance={m.provenance} />
                          {isAI && (m.confirmed_by_therapist
                            ? <span className="uc-badge uc-badge--good">✓ Therapist confirmed</span>
                            : <button className="uc-navlink text-xs" style={{ color: 'var(--accent)' }} onClick={() => confirmMemory(m.id)}>✓ Confirm</button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Exercises */}
      {exercises.length > 0 && (
        <div className="mb-6">
          <span className="uc-label">Assigned exercises</span>
          <div className="mt-2 space-y-2">
            {exercises.map((ex) => (
              <Card key={ex.id} className="py-3 flex items-center justify-between gap-2">
                <span className="text-sm" style={{ color: 'var(--text)' }}>{ex.description}</span>
                <StatusPill status={ex.status} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {transcript.length > 0 && (
        <div>
          <span className="uc-label">Transcript</span>
          <div className="mt-2 space-y-2">
            {transcript.map((line) => {
              const isTherapist = line.speaker === 'therapist'
              const isClient = line.speaker === 'client'
              return (
                <div
                  key={line.seq}
                  className="p-3 rounded-xl"
                  style={{
                    background: isTherapist ? 'var(--accent-soft)' : 'var(--surface)',
                    border: `1px solid ${isTherapist ? 'var(--accent-border)' : 'var(--border)'}`,
                    marginLeft: isClient ? '1.5rem' : 0,
                    marginRight: isTherapist ? '1.5rem' : 0,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: isTherapist ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {line.speaker}
                    </span>
                    <span className="flex items-center gap-2">
                      {/* Fix the label for this line if it's wrong */}
                      {!isTherapist && (
                        <button className="uc-muted text-[10px] uppercase tracking-wide hover:underline" onClick={() => correctSpeaker(line.seq, 'therapist')}>→ therapist</button>
                      )}
                      {!isClient && (
                        <button className="uc-muted text-[10px] uppercase tracking-wide hover:underline" onClick={() => correctSpeaker(line.seq, 'client')}>→ client</button>
                      )}
                      <span className="uc-muted text-xs">{ms(line.start_ms)}</span>
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{line.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!isProcessing && !isFailed && transcript.length === 0 && memory.length === 0 && (
        <Card><p className="uc-secondary text-sm">No transcript or understanding available for this session.</p></Card>
      )}
    </AppShell>
  )
}
