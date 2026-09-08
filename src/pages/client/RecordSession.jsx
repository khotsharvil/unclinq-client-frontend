import { useEffect, useRef, useState } from 'react'
import { sessionsAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Spinner, StatusPill } from '../../components/ui'
import {
  recStoreSupported, appendChunk, getAllChunks, clearChunks,
  setActiveMeta, getActiveMeta, clearActiveMeta,
} from '../../lib/recordingStore'

const STAGES = ['uploaded', 'transcribing', 'transcribed', 'understanding', 'ready']
const PROCESSING = new Set(['uploaded', 'transcribing', 'transcribed', 'understanding'])
const CHUNK_MS = 5000

// iOS Safari supports MediaRecorder (14.3+) but only with mp4/aac — NOT webm.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus', 'audio/webm',
  'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/ogg',
]
const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)

function pickMime() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return MIME_CANDIDATES.find((t) => { try { return MediaRecorder.isTypeSupported(t) } catch { return false } }) || ''
}
function extFor(mime = '') {
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}
function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function RecordSession() {
  const [consented, setConsented] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | recording | uploading | tracking
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [interrupted, setInterrupted] = useState(false)
  const [recovery, setRecovery] = useState(null) // { approxMin, mimeType }
  const [uploadAttempt, setUploadAttempt] = useState(0)
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof window.MediaRecorder !== 'undefined')

  const [sessionId, setSessionId] = useState(null)
  const [status, setStatus] = useState(null)
  const [past, setPast] = useState([])

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const pollRef = useRef(null)
  const wakeLockRef = useRef(null)
  const recordingRef = useRef(false)
  const writeQueueRef = useRef(Promise.resolve()) // serialize IndexedDB appends to keep order

  function loadPast() {
    sessionsAPI.list().then((r) => setPast(r.data.sessions || [])).catch(() => {})
  }

  // On mount: load past sessions AND detect an unfinished recording to recover.
  useEffect(() => {
    loadPast()
    ;(async () => {
      if (!recStoreSupported()) return
      const meta = getActiveMeta()
      if (!meta) return
      try {
        const chunks = await getAllChunks()
        if (chunks.length) {
          setRecovery({ approxMin: Math.max(1, Math.round((chunks.length * CHUNK_MS) / 60000)), mimeType: meta.mimeType || 'audio/mp4' })
        } else {
          clearActiveMeta()
        }
      } catch { /* ignore */ }
    })()
  }, [])

  // Screen Wake Lock — stop auto-lock (which suspends the recorder on iOS).
  async function acquireWakeLock() {
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen') } catch { /* ignore */ }
  }
  function releaseWakeLock() {
    try { wakeLockRef.current?.release?.() } catch { /* ignore */ }
    wakeLockRef.current = null
  }

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        if (recordingRef.current) acquireWakeLock()
      } else if (recordingRef.current) {
        setInterrupted(true) // iOS may suspend in the background; captured audio is already persisted
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timerRef.current)
      clearTimeout(pollRef.current)
      releaseWakeLock()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Keep-the-app-open guard: warn before closing/refreshing mid-recording or
  // mid-upload so a session isn't lost by accident.
  useEffect(() => {
    const active = phase === 'recording' || phase === 'uploading'
    if (!active) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  // Poll processing status until ready/failed.
  useEffect(() => {
    if (!sessionId) return
    if (status && !PROCESSING.has(status)) { loadPast(); return }
    pollRef.current = setTimeout(async () => {
      try {
        const res = await sessionsAPI.get(sessionId)
        setStatus(res.data.session?.status || null)
      } catch { /* keep last known */ }
    }, 4000)
    return () => clearTimeout(pollRef.current)
  }, [sessionId, status])

  async function startRecording() {
    setError(''); setInterrupted(false); setRecovery(null)
    try {
      await clearChunks().catch(() => {}) // fresh recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMime()
      const opts = { audioBitsPerSecond: 64000 }
      if (mimeType) opts.mimeType = mimeType
      const rec = new MediaRecorder(stream, opts)
      const effectiveMime = rec.mimeType || mimeType || 'audio/mp4'
      setActiveMeta({ mimeType: effectiveMime })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
          // Persist each chunk (ordered) so an interruption doesn't lose the session.
          writeQueueRef.current = writeQueueRef.current.then(() => appendChunk(e.data)).catch(() => {})
        }
      }
      rec.onstop = () => doUpload(rec.mimeType || mimeType || 'audio/mp4')
      rec.onerror = () => { setError('Recording stopped unexpectedly. Your captured audio was saved — you can upload it below.'); stopRecording() }
      recorderRef.current = rec
      rec.start(CHUNK_MS)
      recordingRef.current = true
      setSeconds(0)
      setPhase('recording')
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      acquireWakeLock()
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
        : 'Could not start recording on this device.')
    }
  }

  function stopRecording() {
    recordingRef.current = false
    clearInterval(timerRef.current)
    releaseWakeLock()
    try { recorderRef.current?.stop() } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  // Single finalize path — used by normal stop AND by recovery. Reads from
  // IndexedDB (the durable source of truth), falling back to the in-memory chunks.
  async function doUpload(mimeType) {
    setPhase('uploading'); setUploadAttempt(1); setError('')
    try {
      // Let any pending chunk writes settle, then read the durable copy.
      await writeQueueRef.current.catch(() => {})
      let chunks = await getAllChunks().catch(() => [])
      if (!chunks.length) chunks = chunksRef.current
      const blob = new Blob(chunks, { type: mimeType })
      if (!blob.size) throw new Error('empty')
      const fd = new FormData()
      fd.append('audio', blob, `session.${extFor(mimeType)}`)
      fd.append('occurred_at', new Date().toISOString())

      const res = await uploadWithRetry(fd, 3)
      await clearChunks().catch(() => {})
      clearActiveMeta()
      setSessionId(res.data.id)
      setStatus(res.data.status || 'uploaded')
      setPhase('tracking')
      setRecovery(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed after several tries. Your recording is saved — you can try again.')
      setPhase('idle')
      // Re-offer recovery so they can retry without reloading.
      const left = await getAllChunks().catch(() => [])
      if (left.length) setRecovery({ approxMin: Math.max(1, Math.round((left.length * CHUNK_MS) / 60000)), mimeType })
    }
  }

  // Retry the upload on transient failures (network drop / timeout / 5xx).
  async function uploadWithRetry(fd, tries) {
    const backoff = [0, 2000, 5000]
    let lastErr
    for (let i = 0; i < tries; i++) {
      if (backoff[i]) await new Promise((r) => setTimeout(r, backoff[i]))
      setUploadAttempt(i + 1)
      try {
        return await sessionsAPI.upload(fd, { timeout: 180000 })
      } catch (err) {
        lastErr = err
        const status = err.response?.status
        if (status && status < 500) throw err // permanent — don't retry
      }
    }
    throw lastErr
  }

  async function discardRecovery() {
    await clearChunks().catch(() => {})
    clearActiveMeta()
    setRecovery(null)
  }

  function reset() {
    clearTimeout(pollRef.current)
    setSessionId(null); setStatus(null); setSeconds(0); setPhase('idle'); setError(''); setInterrupted(false)
  }

  const currentStage = STAGES.indexOf(status)

  return (
    <AppShell theme="client">
      <div className="font-sans space-y-4">
        <header className="pt-2">
          <span className="label" style={{ color: 'var(--sp-text)' }}>Your session</span>
          <h1 className="font-serif tracking-tight mt-1" style={{ fontSize: '1.9rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Record a session.
          </h1>
          <p className="t-body-sm mt-1">
            Record your therapy session so your notes carry the context forward. The audio is used only to make the notes, and is not saved after.
          </p>
        </header>

        {/* Recovery: an earlier recording was interrupted before it uploaded. */}
        {recovery && phase === 'idle' && (
          <div className="card" style={{ background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
            <p className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Unfinished recording found</p>
            <p className="t-body-sm mt-1 mb-3">
              A recording of about {recovery.approxMin} minute{recovery.approxMin === 1 ? '' : 's'} was interrupted
              before it finished uploading. You can upload what was captured, or discard it.
            </p>
            <div className="flex gap-2">
              <button className="btn-primary" style={{ minHeight: 42, padding: '8px 16px' }} onClick={() => doUpload(recovery.mimeType)}>Upload it</button>
              <button className="btn-secondary" style={{ minHeight: 42, padding: '8px 16px' }} onClick={discardRecovery}>Discard</button>
            </div>
          </div>
        )}

        {!supported && (
          <div className="card"><p className="t-body-sm">This browser can’t record audio. On iPhone use Safari (iOS 14.3 or later); on Android or desktop use Chrome.</p></div>
        )}

        {/* Recorder */}
        {phase !== 'tracking' && (
          <div className="card">
            {phase === 'idle' && (
              <>
                <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface-alt)' }}>
                  <p className="label mb-2" style={{ color: 'var(--text-secondary)' }}>Before you start</p>
                  <ul className="list-disc pl-4 space-y-1 t-body-sm">
                    <li>Keep this screen open for the whole session.</li>
                    {IS_IOS
                      ? <li>On iPhone, try not to lock the phone or switch apps. We keep the screen awake, and if something interrupts it, your recording is saved so you can still upload it.</li>
                      : <li>Try not to lock the phone or leave the app while recording.</li>}
                    <li>A ~50-minute session is fine.</li>
                  </ul>
                </div>
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                  <input type="checkbox" className="mt-1" style={{ accentColor: 'var(--sp)' }} checked={consented} onChange={(e) => setConsented(e.target.checked)} />
                  <span className="t-body-sm">My therapist and I have agreed to record this session.</span>
                </label>
                <button className="btn-primary w-full" disabled={!supported || !consented} onClick={startRecording}>
                  Start recording
                </button>
              </>
            )}

            {phase === 'recording' && (
              <div className="text-center py-2">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="inline-block w-3 h-3 rounded-full glow-pulse" style={{ background: '#B0332F' }} />
                  <span className="t-body-sm">Recording</span>
                </div>
                <div className="font-serif tabular-nums mb-2" style={{ fontSize: '2.4rem', fontWeight: 500, color: 'var(--text-primary)' }}>{fmt(seconds)}</div>
                <p className="t-caption mb-4">Keep this screen open. {IS_IOS ? 'Try not to lock your iPhone.' : "Don’t leave the app."}</p>
                {interrupted && (
                  <p className="text-xs mb-3" style={{ color: '#B0332F' }}>
                    The screen went to the background — recording may have paused. Your audio so far is saved.
                  </p>
                )}
                <button className="btn-primary w-full" onClick={stopRecording}>Stop &amp; save</button>
              </div>
            )}

            {phase === 'uploading' && (
              <div className="flex items-center gap-3 py-2">
                <Spinner size={16} />
                <span className="t-body-sm">Uploading your recording…{uploadAttempt > 1 ? ` (attempt ${uploadAttempt} of 3)` : ''}</span>
              </div>
            )}

            {error && <p className="mt-3 text-sm" style={{ color: '#B0332F' }}>{error}</p>}
          </div>
        )}

        {/* Processing tracker */}
        {phase === 'tracking' && sessionId && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="label">Making your session notes</span>
              <StatusPill status={status} />
            </div>
            <ol className="space-y-2">
              {STAGES.map((stage, i) => {
                const done = currentStage > i, active = currentStage === i
                const label = { uploaded: 'Received', transcribing: 'Transcribing', transcribed: 'Transcribed', understanding: 'Understanding', ready: 'Ready' }[stage]
                return (
                  <li key={stage} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0"
                      style={{ background: done || active ? 'var(--sp)' : 'var(--surface-alt)', color: done || active ? '#fff' : 'var(--text-muted)', border: '1px solid var(--hairline)' }}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="text-sm" style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: active ? 700 : 400 }}>{label}</span>
                    {active && PROCESSING.has(status) && <Spinner size={14} className="ml-1" />}
                  </li>
                )
              })}
            </ol>
            {status === 'ready' && (
              <p className="mt-4 t-body-sm">Done. Your session notes are ready and shared with your therapist.</p>
            )}
            {status === 'failed' && (
              <p className="mt-4 text-sm" style={{ color: '#B0332F' }}>Something went wrong processing this recording. You can try recording again.</p>
            )}
            <div className="mt-4">
              <button className="btn-secondary w-full" onClick={reset}>Record another</button>
            </div>
          </div>
        )}

        {/* Past recordings */}
        <section>
          <span className="label">Your sessions</span>
          <div className="mt-2 space-y-2">
            {past.length === 0 ? (
              <div className="card"><p className="t-body-sm">When you record a session it will show up here.</p></div>
            ) : (
              past.map((s) => (
                <div key={s.id} className="card py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {new Date(s.occurred_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    {s.session_summary && <div className="t-caption truncate mt-0.5">{typeof s.session_summary === 'string' ? s.session_summary : ''}</div>}
                  </div>
                  <StatusPill status={s.status} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
