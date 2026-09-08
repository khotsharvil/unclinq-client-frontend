import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Button, Textarea, Spinner } from '../../components/ui'

/*
 * Prepare — "Prepare for your session".
 * NOT a mandatory weekly form. It's a light, contextual gap-filler: if the client
 * has already captured a lot this week we ask fewer, softer questions; if they've
 * been quiet we ask the fuller set. Whatever they add feeds the therapist briefing.
 */

const FULL_QUESTIONS = [
  { key: 'most_affecting', label: 'What affected you most since your last session?', placeholder: 'A moment, a feeling, a situation…' },
  { key: 'biggest_trigger', label: 'What triggered you most?', placeholder: 'What set things off, if anything' },
  { key: 'tried_from_therapy', label: 'Did you try anything from therapy?', placeholder: 'A technique or step you attempted' },
  { key: 'what_helped', label: 'What helped?', placeholder: 'Anything that made things a little easier' },
  { key: 'wants_to_discuss', label: 'Anything you want to bring into your next session?', placeholder: 'Something to talk through with your therapist' },
]

// When the client has captured plenty already, keep it to the two that matter most.
const SHORT_KEYS = ['most_affecting', 'wants_to_discuss']

export default function Prepare() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState({})
  const [adaptive, setAdaptive] = useState('full') // 'full' | 'short'
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [hasActivity, setHasActivity] = useState(false)

  useEffect(() => {
    let alive = true
    // Decide how much to ask based on how much the client already captured.
    Promise.all([clientAPI.getReflection().catch(() => ({ data: {} })), clientAPI.events().catch(() => ({ data: { events: [] } }))])
      .then(([refRes, evRes]) => {
        if (!alive) return
        const recent = (evRes.data?.events || []).filter((e) => {
          const t = new Date(e.occurred_at).getTime()
          return Date.now() - t < 7 * 24 * 3600 * 1000
        })
        setHasActivity(recent.length >= 3)
        setAdaptive(recent.length >= 3 ? 'short' : 'full')
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const shown = adaptive === 'short' && !expanded
    ? FULL_QUESTIONS.filter((q) => SHORT_KEYS.includes(q.key))
    : FULL_QUESTIONS

  function set(key, value) {
    setAnswers((a) => ({ ...a, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const hasAnswer = Object.values(answers).some((v) => (v || '').trim())
    if (!hasAnswer) {
      setError('Add at least one answer — even a sentence helps.')
      return
    }
    setSaving(true)
    try {
      await clientAPI.saveReflection(answers)
      setSaved(true)
      setTimeout(() => navigate('/home'), 1200)
    } catch {
      setError('We could not save that just now. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell theme="client">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Prepare for your session</h1>
      <p className="uc-secondary mb-5">
        {hasActivity
          ? "You've already captured a fair bit this week — just a couple of quick thoughts."
          : 'A few short thoughts so your session picks up where you are.'}
      </p>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size={26} /></div>
      ) : saved ? (
        <Card accent>
          <p style={{ color: 'var(--text)' }}>Thanks — this goes to your therapist to help prepare. See you at your session.</p>
        </Card>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {shown.map((q) => (
            <Card key={q.key}>
              <Textarea
                label={q.label}
                placeholder={q.placeholder}
                value={answers[q.key] || ''}
                onChange={(e) => set(q.key, e.target.value)}
                rows={2}
              />
            </Card>
          ))}

          {adaptive === 'short' && !expanded && (
            <button type="button" className="uc-btn uc-btn--ghost uc-btn--sm" onClick={() => setExpanded(true)}>
              Add more detail →
            </button>
          )}

          {error && <p className="text-sm" style={{ color: 'var(--accent)' }}>{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Send to my therapist'}
            </Button>
            <Button to="/home" variant="ghost">Later</Button>
          </div>
          <p className="uc-muted text-xs">This isn't a report — it's just to help your session start where you are.</p>
        </form>
      )}
    </AppShell>
  )
}
