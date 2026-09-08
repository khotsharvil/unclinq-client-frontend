import { useEffect, useState } from 'react'
import { clientAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Spinner } from '../../components/ui'

const TRIED = [
  { status: 'assigned', label: 'Not yet' },
  { status: 'in_progress', label: 'Partially' },
  { status: 'done', label: 'Yes' },
]

const ORIGIN_LABEL = { therapist: 'From your therapist', emora: 'Suggested in a chat', client: 'Your own' }

export default function Exercises() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState({})

  function load() {
    clientAPI.exercises()
      .then((res) => setItems(res.data.exercises || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)))
    try { await clientAPI.updateExercise(id, { status }) } catch { /* optimistic */ }
  }
  async function saveNote(id) {
    const feedback = (notes[id] || '').trim()
    if (!feedback) return
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, feedback } : x)))
    setNotes((n) => ({ ...n, [id]: '' }))
    try { await clientAPI.updateExercise(id, { feedback }) } catch { /* optimistic */ }
  }

  const current = items.filter((x) => x.status === 'assigned' || x.status === 'in_progress')
  const past = items.filter((x) => x.status === 'done' || x.status === 'skipped')

  return (
    <AppShell theme="client">
      <div className="font-sans space-y-4">
        <header className="pt-2">
          <span className="label" style={{ color: 'var(--sp-text)' }}>This week’s practice</span>
          <h1 className="font-serif tracking-tight mt-1" style={{ fontSize: '1.9rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Small things to try.
          </h1>
          <p className="t-body-sm mt-1">You don’t have to do them perfectly. Just notice what happens.</p>
        </header>

        {loading ? (
          <div className="py-12 flex justify-center"><Spinner size={24} /></div>
        ) : (
          <>
            {current.length === 0 && (
              <div className="card"><p className="t-body-sm">Nothing to try right now. After your next session, anything your therapist suggests will land here.</p></div>
            )}

            {current.map((x) => (
              <div key={x.id} className="card">
                <span className="label" style={{ color: 'var(--sp-text)' }}>{ORIGIN_LABEL[x.origin] || 'To try'}</span>
                <p className="mt-1.5 font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{x.description}</p>

                <div className="mt-3 pt-3 divider">
                  <span className="t-caption">Have you tried it?</span>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {TRIED.map((t) => (
                      <button key={t.status}
                        className={x.status === t.status ? 'btn-primary' : 'btn-secondary'}
                        style={{ minHeight: 38, padding: '6px 14px', fontSize: 13 }}
                        onClick={() => setStatus(x.id, t.status)}>{t.label}</button>
                    ))}
                  </div>
                  {(x.status === 'in_progress' || x.status === 'done') && (
                    <div className="mt-3">
                      <textarea className="input-field" style={{ minHeight: 64, resize: 'vertical', fontSize: 14 }}
                        placeholder="What happened when you tried it? (optional)"
                        value={notes[x.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
                      <div className="flex justify-end mt-1.5">
                        <button className="btn-ghost" style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }} onClick={() => saveNote(x.id)}>Save note</button>
                      </div>
                    </div>
                  )}
                  {x.feedback && <p className="t-body-sm mt-2" style={{ color: 'var(--text-secondary)' }}>“{x.feedback}”</p>}
                </div>
              </div>
            ))}

            {past.length > 0 && (
              <section>
                <span className="label">Earlier</span>
                <div className="mt-2 space-y-2">
                  {past.map((x) => (
                    <div key={x.id} className="card py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{x.description}</p>
                        <span className="tag shrink-0" style={{ background: x.status === 'done' ? 'rgba(78,122,58,0.10)' : 'var(--surface-subtle)', color: x.status === 'done' ? '#4E7A3A' : 'var(--text-muted)', borderColor: 'transparent' }}>
                          {x.status === 'done' ? 'Tried' : 'Skipped'}
                        </span>
                      </div>
                      {x.feedback && <p className="t-body-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>“{x.feedback}”</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
