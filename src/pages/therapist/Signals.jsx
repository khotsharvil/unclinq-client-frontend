import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { therapistAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Button, Spinner, EmptyState, formatDateTime } from '../../components/ui'

const SEVERITY = {
  urgent: { tone: 'bad', label: 'Urgent' },
  elevated: { tone: 'warn', label: 'Elevated' },
  note: { tone: 'info', label: 'Note' },
}

const SEVERITY_ORDER = { urgent: 0, elevated: 1, note: 2 }

export default function Signals() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [ackingBulk, setAckingBulk] = useState(false)

  useEffect(() => {
    therapistAPI
      .signals()
      .then((res) => setSignals(res.data.signals || []))
      .catch(() => setSignals([]))
      .finally(() => setLoading(false))
  }, [])

  async function ack(id) {
    setBusy(id)
    try {
      await therapistAPI.ackSignal(id)
      setSignals((s) => s.filter((x) => x.id !== id))
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    } finally {
      setBusy(null)
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const sorted = [...signals].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )

  const allSelected = sorted.length > 0 && sorted.every((s) => selected.has(s.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map((s) => s.id)))
  }

  async function ackSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    setAckingBulk(true)
    try {
      await therapistAPI.ackSignals(ids)
      const done = new Set(ids)
      setSignals((s) => s.filter((x) => !done.has(x.id)))
      setSelected(new Set())
    } finally {
      setAckingBulk(false)
    }
  }

  return (
    <AppShell theme="therapist">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Signals</h1>
      <p className="uc-secondary mb-5">Things that may warrant your attention between sessions.</p>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={26} /></div>
      ) : sorted.length === 0 ? (
        <EmptyState title="No open signals" body="You're all caught up." />
      ) : (
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm uc-secondary cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all
            </label>
            {selected.size > 0 && (
              <Button variant="primary" className="uc-btn--sm" disabled={ackingBulk} onClick={ackSelected}>
                {ackingBulk ? <Spinner size={14} /> : `Acknowledge selected (${selected.size})`}
              </Button>
            )}
          </div>
          {sorted.map((s) => {
            const sev = SEVERITY[s.severity] || SEVERITY.note
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label="Select signal"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`uc-badge uc-badge--${sev.tone}`}>{sev.label}</span>
                      <Link
                        to={`/t/clients/${s.client_id}`}
                        className="font-semibold text-sm"
                        style={{ color: 'var(--text)' }}
                      >
                        {s.client_name}
                      </Link>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{s.reason}</p>
                    {s.evidence && <p className="uc-secondary text-sm mt-1 italic">"{s.evidence}"</p>}
                    <p className="uc-muted text-xs mt-1">{formatDateTime(s.created_at)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="uc-btn--sm"
                    disabled={busy === s.id}
                    onClick={() => ack(s.id)}
                  >
                    {busy === s.id ? <Spinner size={14} /> : 'Acknowledge'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
