import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { emoraAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Spinner } from '../../components/ui'

/*
 * Emora chat — the in-the-moment companion. Warm B2C styling; loads history,
 * sends messages, crisis styling, and an "End & save" flow with an optional
 * mood check. Honors a preDraft handed over from Journal ("explore this").
 */
export default function Emora() {
  const navigate = useNavigate()
  const location = useLocation()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState(null)
  const [ending, setEnding] = useState(false)
  const [moodStep, setMoodStep] = useState(false)
  const [reflection, setReflection] = useState('')
  const scrollRef = useRef(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    emoraAPI.getSession()
      .then((res) => { if (alive) setMessages(res.data.messages || []) })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  // Prefill from Journal's "Talk with Emora" handoff.
  useEffect(() => {
    const pre = location.state?.preDraft
    if (pre) setInput(`I just wrote this down: “${pre}”`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const res = await emoraAPI.sendMessage(text)
      setMode(res.data.mode || null)
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply, crisis: !!res.data.crisis }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I had trouble responding just now. Please try again in a moment.' }])
    } finally { setSending(false) }
  }

  async function endSession(mood_end) {
    setEnding(true)
    try {
      await emoraAPI.endSession({
        mood_end,
        reflection_note: reflection.trim() || undefined,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      })
    } catch { /* still navigate home */ } finally {
      navigate('/home', { replace: true })
    }
  }

  return (
    <AppShell theme="client">
      <div className="flex flex-col font-sans" style={{ height: 'calc(100dvh - 150px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full flex items-center justify-center font-serif" style={{ background: 'var(--sp)', color: '#fff', fontSize: 16 }}>E</span>
            <div>
              <h1 className="font-serif" style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>Emora</h1>
              <span className="t-caption">{mode ? mode : 'Here with you'}</span>
            </div>
          </div>
          {!moodStep && (
            <button className="btn-secondary" style={{ minHeight: 38, padding: '6px 14px', fontSize: 13 }} onClick={() => setMoodStep(true)}>
              Done for now
            </button>
          )}
        </div>

        {moodStep ? (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fade-in">
            <h2 className="font-serif text-center" style={{ fontSize: '1.3rem', fontWeight: 500, color: 'var(--text-primary)' }}>How do you feel now?</h2>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[{ key: 'worse', label: 'Heavier' }, { key: 'same', label: 'About the same' }, { key: 'lighter', label: 'Lighter' }].map((m) => (
                <button key={m.key} className="btn-secondary" style={{ minHeight: 44, fontSize: 13, padding: '8px 6px' }} disabled={ending} onClick={() => endSession(m.key)}>{m.label}</button>
              ))}
            </div>
            <label className="block mt-4">
              <span className="label">A note to yourself (optional)</span>
              <textarea className="input-field mt-1.5" style={{ minHeight: 80, resize: 'vertical' }} placeholder="Anything you want to remember from this…" value={reflection} onChange={(e) => setReflection(e.target.value)} />
            </label>
            <button className="btn-ghost mt-3" disabled={ending} onClick={() => endSession(undefined)}>Skip</button>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3">
              {loading ? (
                <div className="flex-1 flex items-center justify-center"><Spinner size={24} /></div>
              ) : messages.length === 0 ? (
                <div className="emora-bubble msg-emora">I’m here. There’s no wrong thing to say. If something’s on your mind — a moment, a worry, something from your week — we can start there.</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'user-bubble msg-user self-end' : 'emora-bubble msg-emora self-start'}
                    style={m.crisis ? { background: '#F7E9E4', borderColor: '#E4B7A6', color: '#7A2E1C' } : undefined}>
                    {m.crisis && <span className="block font-semibold text-xs mb-1">A gentle pause</span>}
                    {m.content}
                  </div>
                ))
              )}
              {sending && (
                <div className="emora-bubble self-start flex items-center gap-1.5" style={{ maxWidth: 'fit-content' }}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              )}
            </div>

            <form onSubmit={send} className="flex items-end gap-2 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
              <textarea rows={1} className="input-field" style={{ minHeight: 48, maxHeight: 120, resize: 'none' }}
                placeholder="What’s going on?" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
              <button className="btn-primary" style={{ minHeight: 48, width: 48, padding: 0, borderRadius: 14, flexShrink: 0 }} disabled={sending || !input.trim()} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ margin: '0 auto' }}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </form>
          </>
        )}
      </div>
    </AppShell>
  )
}
