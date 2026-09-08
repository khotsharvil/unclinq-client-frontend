import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square } from 'lucide-react'
import { clientAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Spinner, formatDate } from '../../components/ui'

/*
 * Journal — capture & reflect. Low friction: one open prompt, save. Capture by
 * TYPING or by VOICE (therapist Q2: clients track in whatever mode is comfortable;
 * voice lowers the friction that hurts follow-through). A voice note is transcribed
 * to text the client can edit before saving — they stay in control.
 * Optionally, the client can say WHY they want to bring a moment into their next
 * session (Q12) — that intent is surfaced to the therapist via the briefing.
 */
export default function Journal() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [text, setText] = useState('')
  const [shareReason, setShareReason] = useState('')
  const [justSaved, setJustSaved] = useState(null) // the reflection text we just saved

  // Voice capture
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const canRecord = typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined'

  function load() {
    clientAPI.events()
      .then((res) => setEvents(res.data.events || []))
      .catch(() => setError('Could not load your reflections.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  useEffect(() => () => { // cleanup: stop any live stream on unmount
    try { recorderRef.current?.stream?.getTracks().forEach((t) => t.stop()) } catch { /* noop */ }
  }, [])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (!blob.size) return
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'voice-note.webm')
          const res = await clientAPI.voiceNote(fd, { timeout: 120000 })
          const t = (res.data.text || '').trim()
          if (t) setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))
          else setError('Didn’t catch that — try recording again.')
        } catch {
          setError('Couldn’t transcribe that recording. You can type instead.')
        } finally { setTranscribing(false) }
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setError('Microphone access is off. You can type instead.')
    }
  }
  function stopRecording() {
    try { recorderRef.current?.stop() } catch { /* noop */ }
    setRecording(false)
  }

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSaving(true); setError('')
    try {
      await clientAPI.addEvent({ reflection: body, share_reason: shareReason.trim() || undefined })
      setJustSaved(body)
      setText(''); setShareReason('')
      load()
    } catch {
      setError('Could not save. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <AppShell theme="client">
      <div className="font-sans space-y-5">
        <header className="pt-2">
          <span className="label" style={{ color: 'var(--sp-text)' }}>Journal</span>
          <h1 className="font-serif tracking-tight mt-1" style={{ fontSize: '1.85rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Take a moment.
          </h1>
          <p className="t-body-sm mt-0.5">A quiet place to think — write it, or tap the mic and just talk.</p>
        </header>

        {/* Compose */}
        <form onSubmit={submit} className="card" style={{ padding: 18 }}>
          <textarea
            className="input-field"
            style={{ minHeight: 130, resize: 'vertical', lineHeight: 1.6, border: 'none', boxShadow: 'none', background: 'transparent', padding: 4 }}
            placeholder={recording ? 'Listening… speak freely, then tap Stop.' : 'What’s on your mind? Write — or tap the mic and just talk.'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />

          {/* Optional: why bring this into the room (client's own reason) */}
          {text.trim() && (
            <div className="animate-fade-in mt-2 pt-2" style={{ borderTop: '1px solid var(--hairline)' }}>
              <input
                className="input-field"
                style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: 4, fontSize: 14 }}
                placeholder="Want to bring this to your therapist? Why does it matter to you? (optional)"
                value={shareReason}
                onChange={(e) => setShareReason(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm mt-1" style={{ color: '#B0332F' }}>{error}</p>}

          <div className="flex justify-between items-center mt-2 gap-2">
            {/* Mic / voice capture */}
            {canRecord ? (
              <button type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className="btn-ghost inline-flex items-center gap-2"
                style={{ minHeight: 44, padding: '10px 14px', color: recording ? '#B0332F' : 'var(--sp-text)' }}
                aria-label={recording ? 'Stop recording' : 'Record a voice note'}
              >
                {transcribing ? <><Spinner size={16} /> <span style={{ fontSize: 13 }}>Transcribing…</span></>
                  : recording ? <><Square size={18} fill="currentColor" /> <span style={{ fontSize: 13 }}>Stop</span></>
                  : <><Mic size={18} /> <span style={{ fontSize: 13 }}>Voice note</span></>}
              </button>
            ) : <span />}

            <button className="btn-primary" style={{ minHeight: 44, padding: '10px 20px' }} disabled={saving || transcribing || !text.trim()}>
              {saving ? <Spinner size={16} /> : 'Save'}
            </button>
          </div>
          {recording && (
            <p className="t-caption mt-1 inline-flex items-center gap-1.5" style={{ color: '#B0332F' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B0332F', display: 'inline-block' }} className="animate-pulse" />
              Recording…
            </p>
          )}
        </form>

        {/* After-save: optional go-deeper (client stays in control) */}
        {justSaved && (
          <div className="card animate-fade-in" style={{ background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
            <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>Saved. Want to explore this a little more?</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="btn-primary" style={{ minHeight: 40, padding: '8px 16px', fontSize: 13 }}
                onClick={() => navigate('/emora', { state: { preDraft: justSaved } })}>Talk with Emora</button>
              <button className="btn-secondary" style={{ minHeight: 40, padding: '8px 16px', fontSize: 13 }}
                onClick={() => navigate('/exercises')}>Try something</button>
              <button className="btn-ghost" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}
                onClick={() => setJustSaved(null)}>Leave it here</button>
            </div>
          </div>
        )}

        {/* Past reflections */}
        <section>
          <span className="label">Your reflections</span>
          <div className="mt-2 space-y-2">
            {loading ? (
              <div className="py-8 flex justify-center"><Spinner size={24} /></div>
            ) : events.length === 0 ? (
              <div className="card"><p className="t-body-sm">Whatever you write gathers here — a quiet record of your weeks.</p></div>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="card" style={{ padding: '12px 16px' }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.trigger || (ev.reflection ? ev.reflection.slice(0, 48) : 'A quiet moment')}</span>
                    <span className="t-caption shrink-0">{formatDate(ev.occurred_at)}</span>
                  </div>
                  {ev.reflection && ev.reflection !== ev.trigger && (
                    <p className="t-body-sm mt-1" style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.reflection}</p>
                  )}
                  {ev.primary_emotion && <span className="tag mt-2 inline-flex">{ev.primary_emotion}</span>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
