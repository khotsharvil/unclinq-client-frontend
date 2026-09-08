import { useState } from 'react'
import { Link } from 'react-router-dom'

/*
 * Shared UI kit for Unclinq B2B2C.
 * Two themes, applied by setting data-theme="client" | "therapist" on a wrapper.
 * Client  = warm paper / clay accent (#C4623F).
 * Therapist = cool neutral / slate-teal accent (#3E6B72).
 * Theme tokens live in index.css under [data-theme=...].
 */

export function Card({ as: Tag = 'div', className = '', accent = false, children, ...rest }) {
  return (
    <Tag
      className={`uc-card ${accent ? 'uc-card--accent' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  as,
  to,
  children,
  ...rest
}) {
  const cls = `uc-btn uc-btn--${variant} ${className}`
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    )
  }
  const Tag = as || 'button'
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}

export function TextInput({ label, className = '', id, ...rest }) {
  return (
    <label className="block">
      {label && <span className="uc-label">{label}</span>}
      <input id={id} className={`uc-input ${className}`} {...rest} />
    </label>
  )
}

export function Textarea({ label, className = '', id, ...rest }) {
  return (
    <label className="block">
      {label && <span className="uc-label">{label}</span>}
      <textarea id={id} className={`uc-input uc-textarea ${className}`} {...rest} />
    </label>
  )
}

export function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`uc-spinner ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 uc-bg">
      <Spinner size={28} />
      <p className="uc-muted text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="uc-empty">
      <p className="uc-empty__title">{title}</p>
      {body && <p className="uc-empty__body">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Generic pill badge.
export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`uc-badge uc-badge--${tone} ${className}`}>{children}</span>
}

/*
 * ProvenanceBadge — a core product requirement.
 * therapist_authored -> solid accent "From your therapist"
 * ai_generated       -> dashed, muted "Emora noticed"
 * client_generated   -> neutral "You added this"
 */
const PROVENANCE = {
  therapist_authored: { label: 'From your therapist', cls: 'uc-prov uc-prov--therapist' },
  ai_generated: { label: 'Emora observation', cls: 'uc-prov uc-prov--ai' },
  client_generated: { label: 'From client', cls: 'uc-prov uc-prov--client' },
  session: { label: 'From session recording', cls: 'uc-prov uc-prov--therapist' },
  // Humanized, not product vocab. Pass `label` to say e.g. "Based on 3 client events".
  derived: { label: 'Based on client activity', cls: 'uc-prov uc-prov--ai' },
}

export function ProvenanceBadge({ provenance, label }) {
  const meta = PROVENANCE[provenance] || {
    label: label || provenance || 'Note',
    cls: 'uc-prov uc-prov--client',
  }
  return <span className={meta.cls}>{label || meta.label}</span>
}

export function StatusPill({ status }) {
  const map = {
    uploaded: 'neutral',
    transcribing: 'info',
    transcribed: 'info',
    understanding: 'info',
    ready: 'good',
    failed: 'bad',
    assigned: 'info',
    in_progress: 'info',
    done: 'good',
    skipped: 'neutral',
    pending: 'warn',
    active: 'good',
    revoked: 'neutral',
  }
  const tone = map[status] || 'neutral'
  return <Badge tone={tone}>{String(status || '').replace(/_/g, ' ')}</Badge>
}

// Small formatted date helper used across pages.
export function formatDate(value, opts) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// "Today · 12:51 PM" / "Tomorrow · 9:00 AM" / "Aug 27 · 3:30 PM"
export function formatRelativeDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const today = new Date(); const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((day - t0) / (24 * 3600 * 1000))
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${label} · ${time}`
}

// "2h ago" / "3d ago" — for freshness lines.
export function timeAgo(value) {
  if (!value) return ''
  const d = new Date(value); if (isNaN(d.getTime())) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 90) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/*
 * Evidence — the "Why am I seeing this? → supporting moments" disclosure.
 * Give it an array of refs [{at, trigger, intensity}]; it stays collapsed until asked.
 */
export function Evidence({ refs = [], label = 'View supporting moments' }) {
  const [open, setOpen] = useState(false)
  if (!refs.length) return null
  return (
    <div className="mt-1">
      <button
        className="uc-navlink text-xs"
        style={{ color: 'var(--accent)' }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide evidence' : `${label} (${refs.length})`}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l-2 pl-3" style={{ borderColor: 'var(--border-strong)' }}>
          {refs.map((r, i) => (
            <li key={r.id || i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="uc-muted">{formatDate(r.at)}</span>
              {r.trigger ? ` — ${r.trigger}` : ''}
              {r.intensity != null ? ` · intensity ${r.intensity}/10` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
