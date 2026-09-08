import { Card, ProvenanceBadge, Evidence, formatDate } from './ui'

/*
 * JourneyMap — the visual therapy journey. Three evidence-first layers, no charts:
 *   1. Journey spine  — the STORY over time. Time is the backbone; sessions are
 *                       landmarks within it (starting point → session → between →
 *                       … → now). Every node traces to evidence.
 *   2. Therapy loop   — the MECHANISM: Before session → Session → After session →
 *                       Next session. Shows what happened *because of* therapy.
 *   3. Pattern Map    — the PATTERN: the recurring sequence as node-cards.
 * (Observed changes, milestones and the raw Timeline live in the Journey tab.)
 */

function Connector() {
  return <div className="flex justify-center py-1" aria-hidden style={{ color: 'var(--text-muted)' }}>↓</div>
}

// A small stacked node-card used by the Therapy loop / Pattern Map.
function Node({ k, children }) {
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--text)' }}>
      {k && <span className="uc-muted text-[10px] uppercase tracking-wide block mb-0.5">{k}</span>}
      {children}
    </div>
  )
}

function NodeChain({ nodes }) {
  const items = nodes.filter(Boolean)
  if (!items.length) return null
  return (
    <div className="flex flex-col">
      {items.map((n, i) => (
        <div key={i}>
          <Node k={n.k}>{n.v}</Node>
          {i < items.length - 1 && <Connector />}
        </div>
      ))}
    </div>
  )
}

const STATUS_WORD = { done: 'tried it', in_progress: 'tried partially', skipped: "didn't try", assigned: 'not tried yet' }

// ─── Journey spine: the story over time ──────────────────────────────────────
function JourneySpine({ spine = [] }) {
  const nodes = spine.filter((n) => n.type !== 'period' || n.count) // drop empty periods
  if (nodes.length <= 1) return null

  return (
    <Card>
      <span className="uc-label">Therapy journey</span>
      <p className="uc-muted text-xs mt-1 mb-3">How the story has evolved — sessions are landmarks along the way.</p>
      <div className="relative pl-5">
        <span className="absolute top-1 bottom-1 left-1 w-px" style={{ background: 'var(--border-strong)' }} aria-hidden />
        <div className="space-y-3">
          {nodes.map((n, i) => (
            <div key={i} className="relative">
              <span
                className="absolute rounded-full"
                style={{
                  left: n.type === 'session' ? '-19px' : '-17px',
                  top: '6px',
                  width: n.type === 'session' ? '12px' : '9px',
                  height: n.type === 'session' ? '12px' : '9px',
                  background: n.type === 'session' || n.type === 'now' ? 'var(--accent)' : 'var(--border-strong)',
                  boxShadow: '0 0 0 3px var(--bg)',
                }}
                aria-hidden
              />
              {n.type === 'session' && (
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Session {n.n} <span className="uc-muted text-xs font-normal">· {formatDate(n.at)}</span>
                  </p>
                  {n.intervention && <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>{n.intervention}</p>}
                </div>
              )}
              {n.type === 'period' && (
                <div>
                  <p className="uc-muted text-xs">
                    {n.label}{n.from ? ` · ${formatDate(n.from)}` : ''}{n.to ? ` → ${formatDate(n.to)}` : ''}
                  </p>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
                    {n.intensity && <div>Anxiety/intensity {n.intensity.from === n.intensity.to ? `${n.intensity.to}/10` : `${n.intensity.from} → ${n.intensity.to}/10`}</div>}
                    {n.top_trigger && <div className="uc-secondary">Mostly around: {n.top_trigger}</div>}
                    {n.tried && <div>Tried {n.tried.technique}{n.tried.outcome ? ` · ${n.tried.outcome}` : ''}</div>}
                    {n.quote && <div className="uc-secondary italic mt-0.5">"{n.quote}"</div>}
                  </div>
                  <Evidence refs={n.evidence} label="View moments" />
                </div>
              )}
              {n.type === 'now' && (
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Now</p>
                  {n.current_focus && <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>{n.current_focus}</p>}
                  {n.wants_to_discuss && <p className="uc-secondary text-sm mt-0.5 italic">Wants to discuss: "{n.wants_to_discuss}"</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function JourneyMap({ journey = {} }) {
  const pattern = (journey.patterns || [])[0]
  const relevantCount = (journey.significant_moments || []).length + (journey.recurring_triggers || []).length

  // Therapy loop: Before session → Session → After session → Next session.
  const before = (journey.significant_moments || [])[0]
  const intervention = (journey.interventions || [])[0]
  const response = (journey.responses || [])[0]
  const applied = response
    ? `${response.action} · ${STATUS_WORD[response.status] || response.status}`
    : ((journey.application?.counts?.done || 0) + (journey.application?.counts?.partial || 0) > 0 ? 'Client attempted the assigned technique' : null)
  const hasLoop = intervention || applied

  return (
    <div className="space-y-4">
      {/* 1. Journey spine — the story (hero) */}
      <JourneySpine spine={journey.spine} />

      {/* 2. Therapy loop — the mechanism (evidence-based Before → Session → After → Next) */}
      {hasLoop && (
        <Card>
          <span className="uc-label">Therapy loop</span>
          <p className="uc-muted text-xs mt-1 mb-3">What happened because of therapy.</p>
          <NodeChain nodes={[
            before && { k: 'Before session', v: <>{before.trigger || before.primary_emotion || 'A recurring experience'}{before.intensity != null ? ` · ${before.intensity}/10` : ''}</> },
            { k: 'Session', v: intervention ? intervention.label : 'Technique introduced' },
            applied && { k: 'After session', v: applied },
            response?.what_happened && { k: 'Client response', v: <em>"{response.what_happened}"</em> },
            { k: 'Next session', v: journey.wants_to_discuss ? `Revisit: "${journey.wants_to_discuss}"` : 'Revisit whether it helped' },
          ]} />
        </Card>
      )}

      {/* 3. Pattern Map — the pattern */}
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="uc-label">Recurring pattern</span>
          <ProvenanceBadge provenance="ai_generated" />
        </div>
        {pattern && pattern.chain ? (
          <>
            <p className="uc-muted text-xs mt-1 mb-3">
              {pattern.count} supporting moment{pattern.count === 1 ? '' : 's'}
              {pattern.last_at ? ` · last seen ${formatDate(pattern.last_at)}` : ''}
            </p>
            <NodeChain nodes={pattern.chain.split(' → ').map((step, i, arr) => ({
              k: i === 0 ? 'Trigger' : i === arr.length - 1 ? 'Response' : null,
              v: step,
            }))} />
            <Evidence refs={pattern.evidence} label="View supporting moments" />
          </>
        ) : (
          <p className="uc-secondary text-sm mt-2">
            No clear recurring pattern yet{relevantCount ? ` · ${relevantCount} relevant moment${relevantCount === 1 ? '' : 's'} so far` : ''}.
          </p>
        )}
      </Card>
    </div>
  )
}
