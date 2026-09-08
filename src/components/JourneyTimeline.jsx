import { Card, StatusPill, formatDate } from './ui'

// A readable label for a milestone. `detail` is a JSONB object, so never render it directly.
function milestoneLabel(m) {
  const d = m.detail || {}
  switch (m.milestone_type) {
    case 'first_session': return 'First session'
    case 'sessions_5': return '5 sessions together'
    case 'sessions_10': return '10 sessions together'
    case 'first_checkin': return 'First between-session check-in'
    case 'intensity_improved':
      return d.from != null && d.to != null ? `Intensity improved (${d.from} → ${d.to}/10)` : 'Intensity improving'
    case 'pattern_recurring':
      return d.count ? `A recurring pattern became clear (${d.count}×)` : 'A recurring pattern became clear'
    default:
      return String(m.milestone_type || 'Milestone').replace(/_/g, ' ')
  }
}

/*
 * Chronological timeline mixing sessions, events, and milestones.
 * Shared by the client journey and therapist journey views.
 */
export default function JourneyTimeline({ sessions = [], events = [], milestones = [], onSessionClick }) {
  const items = [
    ...sessions.map((s) => ({ type: 'session', at: s.occurred_at, data: s })),
    ...events.map((e) => ({ type: 'event', at: e.occurred_at, data: e })),
    ...milestones.map((m) => ({ type: 'milestone', at: m.occurred_at, data: m })),
  ]
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))

  if (items.length === 0) {
    return (
      <div className="uc-empty">
        <p className="uc-empty__title">Nothing on the timeline yet</p>
        <p className="uc-empty__body">Sessions and moments will appear here over time.</p>
      </div>
    )
  }

  return (
    <div className="relative pl-5">
      <span
        className="absolute top-1 bottom-1 left-1 w-px"
        style={{ background: 'var(--border-strong)' }}
        aria-hidden
      />
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="relative">
            <span
              className="absolute -left-[17px] top-4 w-2.5 h-2.5 rounded-full"
              style={{
                background:
                  item.type === 'milestone'
                    ? 'var(--accent)'
                    : item.type === 'session'
                    ? 'var(--text-secondary)'
                    : 'var(--border-strong)',
                boxShadow: '0 0 0 3px var(--bg)',
              }}
              aria-hidden
            />
            {item.type === 'session' && (
              <Card
                as={onSessionClick ? 'button' : 'div'}
                onClick={onSessionClick ? () => onSessionClick(item.data) : undefined}
                className={`w-full text-left ${onSessionClick ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="uc-label">Session</span>
                  <span className="uc-muted text-xs">{formatDate(item.at)}</span>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
                  {item.data.session_summary || 'Session recorded.'}
                </p>
                {item.data.status && (
                  <div className="mt-2">
                    <StatusPill status={item.data.status} />
                  </div>
                )}
              </Card>
            )}
            {item.type === 'event' && (
              <Card>
                <div className="flex items-center justify-between">
                  <span className="uc-label">Moment</span>
                  <span className="uc-muted text-xs">{formatDate(item.at)}</span>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
                  {item.data.trigger || item.data.primary_emotion || 'A moment you captured.'}
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {item.data.primary_emotion && (
                    <span className="uc-badge uc-badge--neutral">{item.data.primary_emotion}</span>
                  )}
                  {item.data.intensity != null && (
                    <span className="uc-badge uc-badge--info">intensity {item.data.intensity}/10</span>
                  )}
                </div>
              </Card>
            )}
            {item.type === 'milestone' && (
              <Card accent>
                <div className="flex items-center justify-between">
                  <span className="uc-label">Milestone</span>
                  <span className="uc-muted text-xs">{formatDate(item.at)}</span>
                </div>
                <p className="text-sm mt-1 font-semibold" style={{ color: 'var(--text)' }}>
                  {milestoneLabel(item.data)}
                </p>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
