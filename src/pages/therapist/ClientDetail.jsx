import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { therapistAPI, sessionsAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import JourneyTimeline from '../../components/JourneyTimeline'
import JourneyMap from '../../components/JourneyMap'
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  StatusPill,
  ProvenanceBadge,
  Evidence,
  formatDate,
  formatDateTime,
  formatRelativeDateTime,
  timeAgo,
} from '../../components/ui'

// Briefing first: the therapist's question on opening a client is
// "what do I need to know before I see this person?" — not "which tab has it?"
const TABS = ['Briefing', 'Journey', 'Sessions', 'Actions', 'Notes']

export default function ClientDetail() {
  const { clientId } = useParams()
  const [tab, setTab] = useState('Briefing')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  function loadOverview() {
    return therapistAPI
      .overview(clientId)
      .then((res) => setOverview(res.data))
      .catch(() => setOverview(null))
  }

  useEffect(() => {
    setLoading(true)
    loadOverview().finally(() => setLoading(false))
  }, [clientId])

  return (
    <AppShell theme="therapist">
      <Link to="/t" className="uc-navlink mb-3 inline-flex">← All clients</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {overview?.client?.name || 'Client'}
          </h1>
          <p className="uc-muted text-sm mb-2">{overview?.client?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <NextSessionControl clientId={clientId} initial={overview?.next_session_at} />
          <ExportMenu clientId={clientId} clientName={overview?.client?.name} />
        </div>
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            className={`uc-tab ${tab === t ? 'uc-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={26} /></div>
      ) : (
        <>
          {tab === 'Briefing' && <BriefingTab clientId={clientId} overview={overview} />}
          {tab === 'Journey' && <JourneyTab clientId={clientId} />}
          {tab === 'Sessions' && <SessionsTab clientId={clientId} />}
          {tab === 'Actions' && <ActionsTab clientId={clientId} data={overview} onChange={loadOverview} />}
          {tab === 'Notes' && <NotesTab clientId={clientId} />}
        </>
      )}
    </AppShell>
  )
}

// ─── Next session (optional, therapist-set) — human-readable, edit on demand. ──
function NextSessionControl({ clientId, initial }) {
  const [at, setAt] = useState(initial || null)     // ISO string or null
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')            // datetime-local draft
  useEffect(() => { setAt(initial || null) }, [initial])

  async function save(e) {
    const v = e.target.value
    setValue(v)
    const iso = v ? new Date(v).toISOString() : null
    try {
      await therapistAPI.setNextSession(clientId, iso)
      setAt(iso); setEditing(false)
    } catch { /* ignore */ }
  }

  if (editing) {
    return (
      <label className="text-xs uc-muted flex items-center gap-1.5">
        Next session
        <input type="datetime-local" className="uc-input" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={value} onChange={save} autoFocus />
      </label>
    )
  }
  return (
    <div className="text-xs uc-muted flex items-center gap-1.5">
      <span>Next session</span>
      {at
        ? <><span style={{ color: 'var(--text)' }}>{formatRelativeDateTime(at)}</span><button className="uc-navlink" style={{ color: 'var(--accent)' }} onClick={() => { setValue(''); setEditing(true) }}>Edit</button></>
        : <><span>Not scheduled</span><button className="uc-navlink" style={{ color: 'var(--accent)' }} onClick={() => { setValue(''); setEditing(true) }}>+ Add</button></>}
    </div>
  )
}

// ─── Export: three renderings of ONE journey model (no separate report engine) ─
function ExportMenu({ clientId, clientName }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run(purpose) {
    setBusy(true)
    setOpen(false)
    try {
      const [jRes, bRes] = await Promise.all([
        therapistAPI.journey(clientId),
        therapistAPI.briefing(clientId).catch(() => ({ data: {} })),
      ])
      const text = buildExport(purpose, { clientName: clientName || 'Client', journey: jRes.data.journey, briefing: bRes.data.briefing })
      const blob = new Blob([text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(clientName || 'client').replace(/\s+/g, '-').toLowerCase()}-${purpose}.md`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setBusy(false) }
  }

  return (
    <div className="relative">
      <button
        className="uc-btn uc-btn--ghost uc-btn--sm"
        title="Export"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label="Export"
      >
        {busy ? <Spinner size={14} /> : '⋯'}
      </button>
      {open && (
        <Card className="absolute right-0 mt-1 z-20 w-56 p-2" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <p className="uc-muted text-xs px-1 pb-1">Export</p>
          {[
            ['documentation', 'Session documentation'],
            ['progress', 'Progress review'],
            ['client', 'Client-friendly summary'],
          ].map(([key, label]) => (
            <button key={key} className="uc-navlink block w-full text-left" onClick={() => run(key)}>{label}</button>
          ))}
        </Card>
      )}
    </div>
  )
}

function buildExport(purpose, { clientName, journey = {}, briefing }) {
  const L = []
  const push = (s) => L.push(s)
  const list = (arr, fn) => (arr || []).forEach((x) => push(fn(x)))

  if (purpose === 'client') {
    push(`# Your therapy journey so far\n`)
    if (journey.current_focus) push(`**What you've been working on:** ${journey.current_focus}\n`)
    if (journey.observed_changes?.length) { push(`**What's been changing:**`); list(journey.observed_changes, (c) => `- ${c.text}`); push('') }
    if (journey.application?.counts) push(`You've been trying the steps from therapy — keep going.\n`)
    push(`\n_This is a summary shared by your therapist._`)
    return L.join('\n')
  }

  push(`# ${clientName} — ${purpose === 'progress' ? 'Progress review' : 'Session documentation'}`)
  push(`_Generated ${new Date().toISOString().slice(0, 10)} from the Unclinq therapy journey model._\n`)
  if (journey.current_focus) push(`## Current focus\n${journey.current_focus}\n`)

  if (purpose === 'documentation') {
    if (journey.recurring_triggers?.length) { push(`## Recurring triggers`); list(journey.recurring_triggers, (t) => `- ${t.trigger} (${t.count}×)`); push('') }
    if (journey.interventions?.length) { push(`## Interventions`); list(journey.interventions, (i) => `- ${i.label}`); push('') }
    if (journey.patterns?.length) { push(`## Patterns`); list(journey.patterns, (p) => `- ${p.chain || p.trigger} (${p.count}×)`); push('') }
  }
  if (journey.responses?.length) { push(`## Application & responses`); list(journey.responses, (r) => `- ${r.action} — ${r.status}: "${r.what_happened}"`); push('') }
  if (journey.observed_changes?.length) { push(`## Observed changes`); list(journey.observed_changes, (c) => `- ${c.text}`); push('') }
  if (briefing?.content) { push(`## Latest pre-session briefing`); push(briefing.content); push('') }
  return L.join('\n')
}

// ─── Actions tab: intervention → application → response (the loop, visible) ────
function ActionsTab({ clientId, data, onChange }) {
  const [exercises, setExercises] = useState(data?.exercises || [])
  const [newExercise, setNewExercise] = useState('')
  const [assigning, setAssigning] = useState(false)
  useEffect(() => { setExercises(data?.exercises || []) }, [data])

  async function assign(e) {
    e.preventDefault()
    if (!newExercise.trim()) return
    setAssigning(true)
    try {
      const res = await therapistAPI.assignExercise(clientId, newExercise.trim())
      setExercises((x) => [{ ...res.data.exercise }, ...x])
      setNewExercise('')
      onChange?.()
    } finally { setAssigning(false) }
  }

  const TRIED = { done: 'Tried it', in_progress: 'Partially', skipped: "Didn't try", assigned: 'Not yet' }
  const row = (ex, i) => (
    <Card key={ex.id || i}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--text)' }}>{ex.description}</p>
        <span className={`uc-badge shrink-0 uc-badge--${ex.status === 'done' ? 'good' : ex.status === 'in_progress' ? 'info' : 'neutral'}`}>
          {TRIED[ex.status] || ex.status}
        </span>
      </div>
      {ex.feedback
        ? <p className="uc-secondary text-sm mt-2 italic">Client: "{ex.feedback}"</p>
        : <p className="uc-muted text-xs mt-2">No note from the client yet.</p>}
    </Card>
  )

  // Active = assigned / in_progress; the rest are history.
  const current = exercises.filter((e) => e.status === 'assigned' || e.status === 'in_progress')
  const past = exercises.filter((e) => e.status === 'done' || e.status === 'skipped')

  return (
    <div className="space-y-4 max-w-2xl">
      {exercises.length === 0 ? (
        <EmptyState title="No actions yet" body="Assign an action; the client's attempts and notes will appear here." />
      ) : (
        <>
          {current.length > 0 && (
            <div className="space-y-2">
              <span className="uc-label">Current actions</span>
              {current.map(row)}
            </div>
          )}
          {past.length > 0 && (
            <details className="mt-2">
              <summary className="uc-navlink text-xs cursor-pointer">Past actions ({past.length})</summary>
              <div className="space-y-2 mt-2">{past.map(row)}</div>
            </details>
          )}
        </>
      )}

      <Card>
        <span className="uc-label">Assign an action</span>
        <p className="uc-muted text-xs mt-1">The client sees this in their app and reports back whether they tried it.</p>
        <form onSubmit={assign} className="mt-2 flex gap-2">
          <input
            className="uc-input flex-1"
            placeholder="e.g. Try a thought record when you notice a strong reaction…"
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
            maxLength={500}
          />
          <Button variant="primary" className="uc-btn--sm" disabled={assigning || !newExercise.trim()}>
            {assigning ? <Spinner size={14} /> : 'Assign'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

function NotesTab({ clientId }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    therapistAPI.notes(clientId)
      .then((res) => setNotes(res.data.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [clientId])

  async function add(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setSaving(true)
    try {
      const res = await therapistAPI.addNote(clientId, draft.trim())
      setNotes((n) => [res.data.note, ...n])
      setDraft('')
    } finally { setSaving(false) }
  }

  async function remove(id) {
    setNotes((n) => n.filter((x) => x.id !== id))
    try { await therapistAPI.deleteNote(id) } catch { load() }
  }

  const [addedIds, setAddedIds] = useState({})
  async function addToJourney(n) {
    setAddedIds((m) => ({ ...m, [n.id]: 'saving' }))
    try {
      await therapistAPI.addMemory(clientId, n.body)
      setAddedIds((m) => ({ ...m, [n.id]: 'done' }))
    } catch {
      setAddedIds((m) => ({ ...m, [n.id]: undefined }))
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <span className="uc-label">🔒 Private note</span>
        <p className="uc-muted text-xs mt-1">Not used by Unclinq unless you explicitly add it to the journey. Never shown to the client.</p>
        <form onSubmit={add} className="mt-2 space-y-2">
          <textarea className="uc-input uc-textarea" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your note…" maxLength={5000} />
          <Button variant="primary" className="uc-btn--sm" disabled={saving || !draft.trim()}>
            {saving ? <Spinner size={14} /> : 'Save note'}
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner size={22} /></div>
      ) : notes.length === 0 ? (
        <p className="uc-muted text-sm">No notes yet.</p>
      ) : (
        notes.map((n) => (
          <Card key={n.id}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{n.body}</p>
              <button className="uc-muted text-xs opacity-60 hover:opacity-100 shrink-0" onClick={() => remove(n.id)} title="Delete note">✕</button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="uc-muted text-xs">{formatDateTime(n.created_at)}</p>
              {addedIds[n.id] === 'done' ? (
                <span className="uc-badge uc-badge--good">Added to journey</span>
              ) : (
                <button className="uc-navlink text-xs" style={{ color: 'var(--accent)' }} onClick={() => addToJourney(n)} disabled={addedIds[n.id] === 'saving'}>
                  {addedIds[n.id] === 'saving' ? 'Adding…' : 'Add to journey →'}
                </button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function SessionsTab({ clientId }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sessionsAPI
      .list(clientId)
      .then((res) => setSessions(res.data.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <div className="py-12 flex justify-center"><Spinner size={26} /></div>

  return (
    <div className="space-y-3">
      {/* The client records sessions in-app; Upload is the therapist's fallback. */}
      <div className="flex justify-end">
        <Button to="/t/upload" variant="secondary" className="uc-btn--sm">Upload a recording</Button>
      </div>
      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          body="When the client records a session (or you upload one), it appears here to review and approve."
        />
      ) : (
        sessions.map((s) => (
          <Link key={s.id} to={`/t/sessions/${s.id}`} className="block">
            <Card className="hover:border-[var(--accent-border)] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  {formatDate(s.occurred_at || s.created_at)}
                </span>
                <StatusPill status={s.status} />
              </div>
              <p className="text-sm mt-1 uc-secondary">
                {s.session_summary || 'Processing / no summary yet.'}
              </p>
              {s.source && <span className="uc-muted text-xs mt-1 inline-block">{s.source}</span>}
            </Card>
          </Link>
        ))
      )}
    </div>
  )
}

// A labelled journey section with an optional provenance badge.
function JGroup({ title, children }) {
  return (
    <div>
      <span className="uc-label">{title}</span>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  )
}
function JItem({ heading, prov, children }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="uc-muted text-xs">{heading}</p>
        {prov && <ProvenanceBadge provenance={prov} />}
      </div>
      <div className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  )
}

const MILESTONE_MARKER = {
  first_session: 'First session',
  first_checkin: 'First check-in',
  sessions_5: '5 sessions',
  sessions_10: '10 sessions',
  intensity_improved: 'Intensity improved',
  pattern_recurring: 'Pattern identified',
}

// ─── Journey: Journey Map hero → observed changes → milestones → collapsed timeline.
function JourneyTab({ clientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTimeline, setShowTimeline] = useState(false)

  useEffect(() => {
    therapistAPI
      .journey(clientId)
      .then((res) => setData(res.data))
      .catch(() => setData({ journey: null, sessions: [], events: [], milestones: [] }))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <div className="py-12 flex justify-center"><Spinner size={26} /></div>
  const j = data?.journey || {}
  const has = (a) => Array.isArray(a) && a.length > 0
  const eventCount = (data?.events || []).length

  return (
    <div className="space-y-4">
      {/* Current focus — small, quiet orientation (not a big card) */}
      <p className="text-sm">
        <span className="uc-muted text-xs mr-1">Current focus</span>
        <span style={{ color: 'var(--text)' }}>{j.current_focus || 'Not set yet.'}</span>
      </p>

      {/* Journey Map — the hero visual */}
      <JourneyMap journey={j} />

      {/* Observed changes — 2–3 evidence-backed facts */}
      {has(j.observed_changes) && (
        <Card>
          <span className="uc-label">Observed changes</span>
          <div className="mt-2 space-y-1.5 text-sm" style={{ color: 'var(--text)' }}>
            {j.observed_changes.map((c, i) => (
              <div key={i}>
                • {c.text}
                <Evidence refs={c.evidence?.filter((e) => e.at)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Milestones — subtle markers */}
      {has(j.milestones) && (
        <div className="flex flex-wrap gap-1.5">
          {j.milestones.map((m, i) => (
            <span key={i} className="uc-badge uc-badge--neutral">
              {MILESTONE_MARKER[m.milestone_type] || m.milestone_type} · {formatDate(m.occurred_at)}
            </span>
          ))}
        </div>
      )}

      {/* Timeline — collapsed evidence layer */}
      <div>
        <button className="uc-navlink text-xs" onClick={() => setShowTimeline((v) => !v)}>
          {showTimeline ? 'Hide timeline' : `Timeline · ${eventCount} event${eventCount === 1 ? '' : 's'} — Show ↓`}
        </button>
        {showTimeline && (
          <div className="mt-2">
            <JourneyTimeline sessions={(data?.sessions || [])} events={(data?.events || [])} milestones={(data?.milestones || [])} />
          </div>
        )}
      </div>
    </div>
  )
}

// Pull the AI's "worth exploring" line out of the narrative for the scannable view.
function worthExploring(content) {
  if (!content) return null
  const line = String(content).split('\n').find((l) => /worth exploring/i.test(l))
  if (!line) return null
  const idx = line.indexOf(':')
  return idx >= 0 ? line.slice(idx + 1).trim() : null
}

function BriefingTab({ clientId, overview }) {
  const [briefing, setBriefing] = useState(undefined) // undefined=loading, null=none
  const [refreshed, setRefreshed] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showNarrative, setShowNarrative] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    therapistAPI
      .briefing(clientId)
      .then((res) => { setBriefing(res.data.briefing || null); setRefreshed(!!res.data.refreshed) })
      .catch(() => setBriefing(null))
  }, [clientId])

  async function generate() {
    setGenerating(true); setError('')
    try {
      const res = await therapistAPI.generateBriefing(clientId)
      setBriefing(res.data.briefing || null); setRefreshed(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not refresh the briefing.')
    } finally { setGenerating(false) }
  }

  if (briefing === undefined) return <div className="py-12 flex justify-center"><Spinner size={26} /></div>
  if (!briefing) {
    return <EmptyState title="No briefing yet" body="A briefing appears once the client has activity between sessions." />
  }

  const s = briefing.structured || {}
  const goals = overview?.goals || []
  const themes = overview?.themes || []
  const explore = worthExploring(briefing.content)
  const src = s.sources || {}
  const noEvents = (s.event_count || 0) === 0

  return (
    <div className="space-y-4">
      {/* Header: maintained-by-Unclinq framing + scope + provenance of the briefing itself */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {s.current_focus && (
            <p className="text-xs mb-1"><span className="uc-muted mr-1">Current focus</span><span style={{ color: 'var(--text)' }}>{s.current_focus}</span></p>
          )}
          <h2 className="text-lg font-bold tracking-tight">Pre-session briefing</h2>
          <p className="uc-muted text-xs mt-0.5">
            {s.since_last_session ? 'Since last session · ' : 'Since '}{formatDate(briefing.period_start)} → {formatDate(briefing.generated_at)}
            {(src.events || src.reflections || src.action_updates)
              ? ` · ${src.events || 0} event${src.events === 1 ? '' : 's'}${src.reflections ? ` · ${src.reflections} reflection` : ''}${src.action_updates ? ` · ${src.action_updates} action update${src.action_updates === 1 ? '' : 's'}` : ''}`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="uc-muted text-xs">Briefing updated {timeAgo(briefing.generated_at)}</p>
          <button className="uc-navlink text-xs" style={{ color: 'var(--accent)' }} onClick={generate} disabled={generating}>
            {generating ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && <Card><p className="text-sm" style={{ color: '#B0332F' }}>{error}</p></Card>}

      {/* What changed — the fast scan: numbers first, source quietly noted */}
      <Card>
        <span className="uc-label">What changed</span>
        {(s.intensity || s.main_trigger) ? (
          <div className="mt-2 space-y-2 text-sm" style={{ color: 'var(--text)' }}>
            {s.intensity && (
              <div>
                {s.intensity.count > 1
                  ? <>Reported intensity <strong>{s.intensity.from} → {s.intensity.to}/10</strong> <span className="uc-muted text-xs">· across {s.intensity.count} reported moments</span></>
                  : <>Reported intensity <strong>{s.intensity.to}/10</strong></>}
                <Evidence refs={s.evidence?.intensity} />
              </div>
            )}
            {s.main_trigger && (
              <div>
                Main trigger: {s.main_trigger} <span className="uc-muted text-xs">· from {src.events || 0} check-in{src.events === 1 ? '' : 's'}</span>
                <Evidence refs={s.evidence?.main_trigger} />
              </div>
            )}
          </div>
        ) : (
          <p className="uc-secondary text-sm mt-2">No new significant events since the last session.</p>
        )}
      </Card>

      {/* Client wants to discuss — one of the two most valuable things */}
      {s.wants_to_discuss && (
        <Card accent>
          <span className="uc-label">Client wants to discuss</span>
          <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>"{s.wants_to_discuss}"</p>
          <p className="uc-muted text-xs mt-1">from client reflection</p>
        </Card>
      )}

      {/* What they tried — explicitly reported only */}
      <Card>
        <span className="uc-label">What they tried</span>
        {s.technique_application
          ? <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>{s.technique_application}</p>
          : <p className="uc-secondary text-sm mt-1">No technique application recorded since the last session.</p>}
      </Card>

      {/* Observed pattern — real chain only, framed as an observation, evidence attached */}
      {s.pattern ? (
        <Card>
          <div className="flex items-center gap-2">
            <span className="uc-label">Observed pattern</span>
            <ProvenanceBadge provenance="ai_generated" />
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>{s.pattern}</p>
          {s.recurrence_count > 1 && <p className="uc-muted text-xs mt-0.5">seen {s.recurrence_count}× since last session</p>}
          <Evidence refs={s.evidence?.pattern} label="View evidence" />
        </Card>
      ) : (
        <Card>
          <span className="uc-label">Observed pattern</span>
          <p className="uc-secondary text-sm mt-1">No clear recurring pattern yet.</p>
        </Card>
      )}

      {/* Worth exploring — prefer the client's own question */}
      {explore && (
        <Card>
          <span className="uc-label">Worth exploring</span>
          <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>{explore}</p>
        </Card>
      )}

      {/* Context footer */}
      {(s.current_focus || goals.length > 0 || themes.length > 0) && (
        <Card>
          <span className="uc-label">Context</span>
          {s.current_focus && <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}><span className="uc-muted text-xs mr-1">focus</span>{s.current_focus}</p>}
          <div className="mt-2 space-y-1.5">
            {goals.map((g, i) => (
              <div key={`g${i}`} className="flex items-start justify-between gap-2">
                <span className="text-sm" style={{ color: 'var(--text)' }}><span className="uc-muted text-xs mr-1">goal</span>{g.content}</span>
                <ProvenanceBadge provenance={g.provenance} />
              </div>
            ))}
            {themes.map((t, i) => (
              <div key={`t${i}`} className="flex items-start justify-between gap-2">
                <span className="text-sm" style={{ color: 'var(--text)' }}><span className="uc-muted text-xs mr-1">theme</span>{t.content}</span>
                <ProvenanceBadge provenance={t.provenance} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Full AI narrative, collapsed by default */}
      {briefing.content && (
        <div>
          <button className="uc-navlink text-xs" onClick={() => setShowNarrative((v) => !v)}>
            {showNarrative ? 'Hide full narrative' : 'Read full narrative'}
          </button>
          {showNarrative && (
            <Card className="mt-2">
              <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{briefing.content}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
