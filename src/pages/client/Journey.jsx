import { useEffect, useState } from 'react'
import { clientAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Spinner, formatDate } from '../../components/ui'

/*
 * Client Journey — mirrors the therapist dashboard's Journey: the SAME model
 * (assembleJourney), rendered as the same card groups (how things are changing,
 * patterns, the journey so far, what you've tried). Each card expands for detail.
 */
const CHANGE_LABEL = {
  intensity: 'How intense things have felt',
  pattern: 'A pattern is showing up',
  skill: 'You’re starting to use the tools',
}

// Client-facing: we speak in plain language, never raw 1–10 numbers.
// (The therapist side keeps the underlying figures; this is just the read-out.)
function intensityWord(n) {
  if (typeof n !== 'number') return null
  if (n <= 3) return 'gentle'
  if (n <= 6) return 'moderate'
  if (n <= 8) return 'intense'
  return 'very intense'
}
function trendPhrase(from, to) {
  if (from == null || to == null) return null
  if (to < from - 0.3) return 'calmer lately'
  if (to > from + 0.3) return 'more intense lately'
  return `mostly ${intensityWord(Math.round((from + to) / 2))}`
}
function trendSentence(from, to) {
  if (to < from - 0.3) return 'The moments you logged have felt calmer lately than they did earlier on.'
  if (to > from + 0.3) return 'The moments you logged have felt more intense lately than they did earlier on.'
  return 'The moments you logged have stayed at a fairly steady level.'
}

export default function Journey() {
  const [j, setJ] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clientAPI.journeyModel()
      .then((res) => setJ(res.data.journey))
      .catch(() => setJ(null))
      .finally(() => setLoading(false))
  }, [])

  const spine = j?.spine || []
  const changes = j?.observed_changes || []
  const patterns = j?.patterns || []
  const moments = j?.significant_moments || []
  const responses = j?.responses || []
  const empty = !spine.length && !changes.length && !patterns.length && !moments.length && !responses.length

  return (
    <AppShell theme="client">
      <div className="font-sans">
        <header className="pt-2 mb-4">
          <span className="label" style={{ color: 'var(--sp-text)' }}>Your journey</span>
          <h1 className="font-serif tracking-tight mt-1" style={{ fontSize: '1.9rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            How far you’ve come.
          </h1>
          {j && (
            <p className="t-body-sm mt-1">
              {j.session_count ? `${j.session_count} session${j.session_count === 1 ? '' : 's'}` : 'Your first weeks'}
              {j.span?.from ? ` · since ${formatDate(j.span.from)}` : ''}
            </p>
          )}
        </header>

        {loading ? (
          <div className="py-12 flex justify-center"><Spinner size={24} /></div>
        ) : empty ? (
          <div className="card"><p className="t-body-sm">Your story starts here. As you check in, talk with Emora, and meet your therapist, this fills in.</p></div>
        ) : (
          <div className="space-y-6">
            {j?.current_focus && (
              <div className="card" style={{ background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
                <span className="label" style={{ color: 'var(--sp-text)' }}>What you’re working on</span>
                <p className="mt-1 font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{j.current_focus}</p>
              </div>
            )}

            {spine.length > 0 && (
              <section>
                <span className="label">Your journey so far</span>
                <JourneySpine nodes={spine} />
              </section>
            )}

            {changes.length > 0 && (
              <Section title="How things are changing" count={changes.length} defaultOpen>
                {changes.map((c, i) => (
                  <ExpandCard key={i} title={CHANGE_LABEL[c.kind] || 'A change'} sub={c.kind === 'intensity' ? trendPhrase(c.from, c.to) : null}>
                    <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>{c.kind === 'intensity' ? trendSentence(c.from, c.to) : c.text}</p>
                    {c.evidence?.length ? <p className="t-caption mt-2">Based on {c.evidence.length} moment{c.evidence.length === 1 ? '' : 's'} you logged.</p> : null}
                  </ExpandCard>
                ))}
              </Section>
            )}

            {patterns.length > 0 && (
              <Section title="Patterns you’ve noticed" count={patterns.length}>
                {patterns.map((p, i) => (
                  <ExpandCard key={i} title={p.trigger || 'A recurring pattern'} sub={`seen ${p.count}×`}>
                    {p.chain && <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>{p.chain}</p>}
                    {p.last_at && <p className="t-caption mt-2">Last seen {formatDate(p.last_at)}</p>}
                  </ExpandCard>
                ))}
              </Section>
            )}

            {moments.length > 0 && (
              <Section title="Moments that mattered" count={moments.length}>
                {moments.map((m, i) => (
                  <ExpandCard key={i} title={m.trigger || 'A hard moment'} chip={m.primary_emotion} date={formatDate(m.occurred_at)}>
                    {m.reflection && <p className="t-body-sm italic" style={{ color: 'var(--text-secondary)' }}>“{m.reflection}”</p>}
                    {typeof m.intensity === 'number' && <p className="t-caption mt-2">Felt {intensityWord(m.intensity)}</p>}
                  </ExpandCard>
                ))}
              </Section>
            )}

            {responses.length > 0 && (
              <Section title="What you’ve tried" count={responses.length}>
                {responses.map((r, i) => (
                  <ExpandCard key={i} title={r.action} sub={r.status === 'done' ? 'Tried' : r.status === 'in_progress' ? 'Partly' : r.status}>
                    {r.what_happened && <p className="t-body-sm italic" style={{ color: 'var(--text-secondary)' }}>“{r.what_happened}”</p>}
                  </ExpandCard>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

/*
 * JourneySpine — the visual timeline. A vertical thread with a node for every
 * landmark: session dots (numbered, terracotta), between-session periods (soft
 * sage, with what came up + how intensity moved), and a "you are here" node.
 * Mirrors the therapist dashboard's Journey graphic, from the client's own spine.
 */
function JourneySpine({ nodes }) {
  return (
    <div className="mt-3 relative" style={{ paddingLeft: 34 }}>
      {/* the thread */}
      <div style={{ position: 'absolute', left: 15, top: 10, bottom: 10, width: 2, background: 'var(--hairline)' }} />
      <div className="space-y-3">
        {nodes.map((n, i) => (
          <SpineNode key={i} n={n} last={i === nodes.length - 1} />
        ))}
      </div>
    </div>
  )
}

function SpineNode({ n }) {
  const [open, setOpen] = useState(false)

  if (n.type === 'starting') {
    return (
      <div className="relative">
        <span style={dotStyle('now')} />
        <div className="card" style={{ padding: '12px 16px', background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--sp-text)' }}>Where you started</p>
          {n.summary && <p className="t-body-sm mt-1" style={{ color: 'var(--text-primary)' }}>{n.summary}</p>}
          {(n.prior_sessions || n.started_at) && (
            <p className="t-caption mt-1">
              {n.prior_sessions ? `${n.prior_sessions} session${n.prior_sessions === 1 ? '' : 's'} together before Unclinq` : ''}
              {n.prior_sessions && n.started_at ? ' · ' : ''}
              {n.started_at ? `since ${formatDate(n.started_at)}` : ''}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (n.type === 'session') {
    return (
      <div className="relative">
        <span style={dotStyle('session')}>{n.n}</span>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Session {n.n}</p>
            <span className="t-caption">{formatDate(n.at)}</span>
          </div>
          {(n.intervention || n.summary) && (
            <p className="t-body-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{n.intervention || n.summary}</p>
          )}
        </div>
      </div>
    )
  }

  if (n.type === 'now') {
    return (
      <div className="relative">
        <span style={dotStyle('now')} />
        <div className="card" style={{ padding: '12px 16px', background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--sp-text)' }}>You are here</p>
          {n.current_focus
            ? <p className="t-body-sm mt-1" style={{ color: 'var(--text-primary)' }}>{n.current_focus}</p>
            : <p className="t-body-sm mt-1" style={{ color: 'var(--text-secondary)' }}>This is where your story stands right now — every check-in adds to it.</p>}
          {n.wants_to_discuss && <p className="t-caption mt-1">To bring up next: {n.wants_to_discuss}</p>}
        </div>
      </div>
    )
  }

  // period
  const moved = n.intensity && typeof n.intensity.from === 'number' && typeof n.intensity.to === 'number'
  const hasDetail = n.quote || n.tried
  return (
    <div className="relative">
      <span style={dotStyle('period')} />
      <div className="card" style={{ padding: '10px 16px', background: 'transparent', boxShadow: 'none', border: '1px dashed var(--hairline)' }}>
        <button onClick={() => hasDetail && setOpen((o) => !o)} className="w-full text-left" style={{ cursor: hasDetail ? 'pointer' : 'default' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="t-caption" style={{ color: 'var(--text-muted)' }}>{n.label}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {n.count ? <span className="tag">{n.count} moment{n.count === 1 ? '' : 's'}</span> : null}
              {moved && <span className="tag">{trendPhrase(n.intensity.from, n.intensity.to)}</span>}
            </div>
          </div>
          {n.top_trigger && <p className="t-body-sm mt-1" style={{ color: 'var(--text-primary)' }}>Mostly around {n.top_trigger}</p>}
        </button>
        {open && hasDetail && (
          <div className="mt-2 pt-2 animate-fade-in" style={{ borderTop: '1px solid var(--hairline)' }}>
            {n.tried?.technique && <p className="t-caption">You tried {n.tried.technique}{n.tried.outcome ? ` — ${n.tried.outcome}` : ''}.</p>}
            {n.quote && <p className="t-body-sm italic mt-1" style={{ color: 'var(--text-secondary)' }}>“{n.quote}”</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function dotStyle(kind) {
  const base = {
    position: 'absolute', left: -34, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', zIndex: 1, fontSize: 11, fontWeight: 600, color: '#fff',
    boxShadow: '0 0 0 3px var(--surface, #fff)',
  }
  if (kind === 'session') return { ...base, top: 12, width: 24, height: 24, background: 'var(--accent, #C08A6A)' }
  if (kind === 'now') return { ...base, top: 12, width: 24, height: 24, background: 'var(--sp-text, #5C7F79)' }
  return { ...base, top: 12, width: 12, height: 12, marginLeft: 6, background: 'var(--sp-border, #B9CFC9)' }
}

// Collapsible section — collapsed by default (except the first) so the Journey
// opens short: focus + the visual spine, with detail a tap away.
function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between py-1" aria-expanded={open}>
        <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {title}
          {count != null && <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="mt-2 space-y-2 animate-fade-in">{children}</div>}
    </section>
  )
}

function ExpandCard({ title, sub, chip, date, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-5 py-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {chip && <span className="tag">{chip}</span>}
            {sub && <span className="t-caption" style={{ color: 'var(--sp-text)' }}>{sub}</span>}
            {date && <span className="t-caption">{date}</span>}
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 2 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-0 animate-fade-in" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  )
}
