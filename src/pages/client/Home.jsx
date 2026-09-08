import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Sprout, Mic, Wind, ChevronRight } from 'lucide-react'
import { clientAPI } from '../../services/api'
import { useApp } from '../../context/AppContext'
import AppShell from '../../components/AppShell'
import { Spinner, formatDate, formatDateTime } from '../../components/ui'

/*
 * Home — one calm answer to "what now?": a single hero (talk to Emora), what
 * you're working on, a compact grid of the other things you can do, and a short
 * trail of recent moments. No long stack of look-alike cards, no counts/intensity.
 */
const TRIED = [
  { status: 'assigned', label: 'Not yet' },
  { status: 'in_progress', label: 'Partially' },
  { status: 'done', label: 'Yes' },
]
function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Evening'
}

export default function Home() {
  const { profile } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    clientAPI.home()
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setError('We could not load your home right now.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  async function dismiss(id) {
    setData((d) => ({ ...d, notifications: (d.notifications || []).filter((n) => n.id !== id) }))
    try { await clientAPI.dismissNotification(id) } catch { /* optimistic */ }
  }
  async function setActionStatus(status) {
    setData((d) => ({ ...d, next_action: { ...d.next_action, status } }))
    try { await clientAPI.updateExercise(data.next_action.id, { status }) } catch { /* optimistic */ }
  }
  const [mood, setMood] = useState(null)
  async function pickMood(m) {
    setMood(m)
    try { await clientAPI.checkIn({ primary_emotion: m }) } catch { /* optimistic */ }
  }

  const first = (profile?.name || '').split(' ')[0]
  const moments = (data?.moments || []).slice(0, 3)

  return (
    <AppShell theme="client">
      {loading ? (
        <div className="py-24 flex justify-center"><Spinner size={26} /></div>
      ) : (
        <div className="space-y-5 font-sans">
          {/* Greeting */}
          <header className="pt-1">
            <h1 className="font-serif tracking-tight" style={{ fontSize: '1.85rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {first ? `${greeting()}, ${first}.` : `${greeting()}.`}
            </h1>
            <p className="t-body-sm mt-0.5">
              {data?.therapist_name ? `Between sessions with ${data.therapist_name}` : 'Your space between sessions'}
              {data?.next_session_at ? ` · next ${formatDate(data.next_session_at)}` : ''}
            </p>
          </header>

          {error && <div className="card"><p className="t-body-sm">{error}</p></div>}

          {/* Prepare — slim banner, only when a session is near */}
          {data?.prepare_due && (
            <Link to="/prepare" className="card-interactive block" style={{ background: 'var(--sp-light)', borderColor: 'var(--sp-border)', padding: '12px 16px' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="label" style={{ color: 'var(--sp-text)' }}>Session coming up</span>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>A few quick thoughts now will make it more useful.</p>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--sp-text)', flexShrink: 0 }} />
              </div>
            </Link>
          )}

          {/* Emora noticed — quiet, dismissible */}
          {(data?.notifications || []).slice(0, 2).map((n) => (
            <div key={n.id} className="card flex items-start gap-3" style={{ padding: '12px 16px' }}>
              <div className="flex-1 min-w-0">
                <span className="tag mb-1.5 inline-flex" style={{ borderStyle: 'dashed' }}>Emora noticed</span>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.message}</p>
                {n.action_path && <Link to={n.action_path} className="text-sm font-semibold mt-1.5 inline-block" style={{ color: 'var(--sp-text)' }}>Take a look →</Link>}
              </div>
              <button className="btn-ghost" style={{ minHeight: 'auto', padding: '2px 8px' }} onClick={() => dismiss(n.id)} aria-label="Dismiss">✕</button>
            </div>
          ))}

          {/* Hero — a warm daily check-in that flows into talking it through */}
          <section style={{ padding: '22px', borderRadius: 22, color: '#fff',
            background: 'linear-gradient(140deg, #C86A47 0%, #A8452B 100%)',
            boxShadow: '0 12px 30px rgba(168,69,43,0.28)' }}>
            <h2 className="font-serif" style={{ fontSize: '1.45rem', fontWeight: 500, lineHeight: 1.2 }}>
              {mood ? 'Thanks for checking in.' : 'How are you, right now?'}
            </h2>
            {!mood ? (
              <>
                <p style={{ fontSize: '0.9rem', opacity: 0.85, marginTop: 4 }}>Tap what’s closest — it’s just for you.</p>
                <div className="flex gap-2 flex-wrap mt-3.5">
                  {['okay', 'anxious', 'low', 'hopeful', 'tired', 'overwhelmed'].map((m) => (
                    <button key={m} onClick={() => pickMood(m)}
                      style={{ padding: '9px 16px', borderRadius: 999, fontSize: 14, fontWeight: 500, color: '#fff',
                        background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(4px)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseDown={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}>
                      {m}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.95rem', opacity: 0.9, marginTop: 6 }}>You’re feeling <b>{mood}</b>. Want to talk it through? Emora knows what you’re working on.</p>
                <Link to="/emora" state={{ mood }} className="w-full mt-4 flex items-center justify-center gap-2"
                  style={{ display: 'flex', minHeight: 48, borderRadius: 14, background: '#fff', color: '#A8452B', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}>
                  Talk with Emora
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </Link>
              </>
            )}
          </section>

          {/* What you're working on */}
          {(data?.current_focus || data?.next_action) && (
            <section className="card">
              <span className="label" style={{ color: 'var(--sp-text)' }}>You’re working on</span>
              {data?.current_focus && (
                <p className="mt-1 font-serif" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>{data.current_focus}</p>
              )}
              {data?.next_action && (
                <div className="mt-3 pt-3 divider">
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{data.next_action.description}</p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {TRIED.map((t) => (
                      <button key={t.status}
                        className={data.next_action.status === t.status ? 'btn-primary' : 'btn-secondary'}
                        style={{ minHeight: 36, padding: '6px 14px', fontSize: 13 }}
                        onClick={() => setActionStatus(t.status)}>{t.label}</button>
                    ))}
                    <Link to="/exercises" className="t-caption ml-auto" style={{ color: 'var(--sp-text)' }}>Details →</Link>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Quick actions — compact grid instead of four stacked cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <Tile to="/journal" Icon={NotebookPen} title="Journal" sub="Write a moment" />
            <Tile to="/exercises" Icon={Sprout} title="Practice" sub="Your exercises" />
            <Tile to="/record" Icon={Mic} title="Record" sub="A session today" />
            <Tile to="/rescue" Icon={Wind} title="Rescue" sub="A calm reset" calm />
          </div>

          {/* Recent moments — short trail (full list lives in Journey/Journal) */}
          {moments.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <span className="label">Recent moments</span>
                <Link to="/journey" className="t-caption" style={{ color: 'var(--sp-text)' }}>See journey →</Link>
              </div>
              <div className="mt-2 space-y-2">
                {moments.map((m) => (
                  <div key={m.id} className="card py-3" style={{ padding: '12px 16px' }}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.title || m.trigger || 'A quiet moment'}</p>
                      <span className="t-caption shrink-0">{formatDate(m.last_activity_at || m.occurred_at)}</span>
                    </div>
                    {(m.primary_emotion || m.technique?.technique || m.status === 'significant') && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {m.primary_emotion && <span className="tag">{m.primary_emotion}</span>}
                        {m.technique?.technique && <span className="tag" style={{ background: 'var(--sp-light)', color: 'var(--sp-text)', borderColor: 'var(--sp-border)' }}>tried {m.technique.technique}</span>}
                        {m.status === 'significant' && <span className="tag" style={{ background: 'rgba(78,122,58,0.10)', color: '#4E7A3A', borderColor: 'rgba(78,122,58,0.25)' }}>worth revisiting</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  )
}

// Compact quick-action tile.
function Tile({ to, Icon, title, sub, calm }) {
  const accent = calm ? '#5C7F79' : 'var(--sp-text)'
  const bg = calm ? 'rgba(92,127,121,0.10)' : 'rgba(var(--sp-rgb),0.10)'
  return (
    <Link to={to} className="card-interactive" style={{ padding: '16px', display: 'block' }}>
      <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: bg, color: accent }}>
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <p className="text-sm font-semibold mt-2.5" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="t-caption mt-0.5">{sub}</p>
    </Link>
  )
}
