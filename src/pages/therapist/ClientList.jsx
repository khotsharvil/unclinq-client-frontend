import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { therapistAPI, linksAPI } from '../../services/api'
import { useApp } from '../../context/AppContext'
import AppShell from '../../components/AppShell'
import { Card, Button, Spinner, EmptyState, StatusPill, formatRelativeDateTime } from '../../components/ui'

function sinceLabel(value) {
  if (!value) return 'no sessions yet'
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (24 * 3600 * 1000))
  if (days <= 0) return 'last session today'
  if (days === 1) return 'last session yesterday'
  return `last session ${days} days ago`
}

// Human status a therapist reads at a glance — never "N signals".
function reviewLine(c) {
  const toReview = c.open_signals || 0
  if (c.new_activity_since_briefing) return 'New activity since last briefing'
  if (toReview > 0) return `Briefing ready · ${toReview} thing${toReview > 1 ? 's' : ''} to review`
  if (c.latest_briefing_at) return 'Briefing ready'
  return 'No new activity'
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function ClientList() {
  const { profile } = useApp()
  const [clients, setClients] = useState([])
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  function load() {
    therapistAPI.clients()
      .then((res) => setClients(res.data.clients || []))
      .catch(() => setError('Could not load your clients.'))
      .finally(() => setLoading(false))
    therapistAPI.signals().then((res) => setSignals(res.data.signals || [])).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const firstName = (profile?.name || '').split(' ')[0]
  const q = query.trim().toLowerCase()
  const visibleClients = clients.filter((c) =>
    !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))

  // Upcoming = clients with a future next session, soonest first.
  const upcoming = clients
    .filter((c) => c.next_session_at && new Date(c.next_session_at).getTime() > Date.now() - 3600 * 1000)
    .sort((a, b) => new Date(a.next_session_at) - new Date(b.next_session_at))

  async function invite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg('')
    try {
      await linksAPI.create(inviteEmail.trim())
      setInviteMsg('Invitation sent. Your client will see it when they sign in.')
      setInviteEmail(''); load()
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Could not send invitation.')
    } finally { setInviting(false) }
  }

  return (
    <AppShell theme="therapist">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="uc-secondary">Here's what to prepare for.</p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen((v) => !v)}>Invite a client</Button>
      </div>

      {inviteOpen && (
        <Card className="mb-5 max-w-lg">
          <form onSubmit={invite} className="space-y-3">
            <label className="block">
              <span className="uc-label">Client email</span>
              <input type="email" className="uc-input" placeholder="client@example.com"
                value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </label>
            {inviteMsg && <p className="text-sm uc-secondary">{inviteMsg}</p>}
            <Button variant="primary" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Spinner size={16} /> : 'Send invitation'}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={26} /></div>
      ) : error ? (
        <Card><p className="uc-secondary text-sm">{error}</p></Card>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Invite a client by email. Once they accept, their between-session activity appears here."
          action={<Button variant="primary" onClick={() => setInviteOpen(true)}>Invite a client</Button>}
        />
      ) : (
        <div className="space-y-6">
          {/* ── Upcoming sessions ─────────────────────────────────────────── */}
          {upcoming.length > 0 && (
            <section>
              <span className="uc-label">Upcoming sessions</span>
              <div className="mt-2 space-y-2">
                {upcoming.map((c) => (
                  <Link key={c.client_id} to={`/t/clients/${c.client_id}`} className="block">
                    <Card className="hover:border-[var(--accent-border)] transition-colors py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{c.name || c.email}</span>
                        <span className="uc-muted text-xs shrink-0">{formatRelativeDateTime(c.next_session_at)}</span>
                      </div>
                      <p className="uc-secondary text-sm mt-0.5">{reviewLine(c)}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Needs attention (evidence-first, no alarmism) ─────────────── */}
          {signals.length > 0 && (
            <section>
              <span className="uc-label">Needs attention</span>
              <div className="mt-2 space-y-2">
                {signals.slice(0, 6).map((s) => (
                  <Link key={s.id} to={`/t/clients/${s.client_id}`} className="block">
                    <Card className="hover:border-[var(--accent-border)] transition-colors py-3">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{s.client_name}</p>
                      {s.evidence
                        ? <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>Client said: "{s.evidence}"</p>
                        : <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{s.reason}</p>}
                      {s.evidence && s.reason && <p className="uc-muted text-xs mt-1">Context: {s.reason}</p>}
                      <span className="text-sm font-semibold mt-1 inline-block" style={{ color: 'var(--accent)' }}>Review context →</span>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Clients ───────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="uc-label">Clients</span>
              <input className="uc-input max-w-[220px]" style={{ padding: '4px 10px' }}
                placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {visibleClients.length === 0 ? (
              <Card><p className="uc-secondary text-sm">No clients match your search.</p></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleClients.map((c) => (
                  <Link key={c.client_id} to={`/t/clients/${c.client_id}`} className="block">
                    <Card className="h-full hover:border-[var(--accent-border)] transition-colors">
                      <p className="font-semibold" style={{ color: 'var(--text)' }}>{c.name || c.email}</p>
                      <p className="uc-muted text-xs">{c.email}</p>
                      <p className="mt-3 text-sm uc-secondary">
                        {reviewLine(c)}<span className="uc-muted"> · {sinceLabel(c.latest_session_at)}</span>
                      </p>
                      {c.next_session_at && (
                        <p className="mt-1 text-xs uc-muted">Next session {formatRelativeDateTime(c.next_session_at)}</p>
                      )}
                      {c.latest_session_status && c.latest_session_status !== 'ready' && (
                        <div className="mt-2"><StatusPill status={c.latest_session_status} /></div>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
