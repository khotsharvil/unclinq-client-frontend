import { useEffect, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'

/*
 * Rescue — in-the-moment steadying. A small set of guided exercises for hard
 * moments (not clinical, never crisis care). Calm teal "safety" hue over the
 * warm client theme. Self-contained; no session data required.
 */
const CALM = '#5C7F79'
const CALM_SOFT = 'rgba(92,127,121,0.12)'

const EXERCISES = [
  { id: 'breath', title: 'Paced breathing', sub: 'Slow, even breaths to settle the body', time: '~2 min' },
  { id: 'ground', title: '5·4·3·2·1 grounding', sub: 'Come back to the room through your senses', time: '~3 min' },
  { id: 'sigh', title: 'Two calming sighs', sub: 'A fast reset when it spikes', time: '30 sec' },
  { id: 'name', title: 'Name it to tame it', sub: 'Put the feeling into words to loosen its grip', time: '~1 min' },
  { id: 'soften', title: 'Soften & settle', sub: 'Release the tension your body is holding', time: '~1 min' },
]

export default function Rescue() {
  const [active, setActive] = useState(null)

  return (
    <AppShell theme="client">
      <div className="font-sans">
        {!active ? (
          <div className="space-y-4 animate-fade-in">
            <header className="pt-2">
              <span className="label" style={{ color: CALM }}>Rescue</span>
              <h1 className="font-serif tracking-tight mt-1" style={{ fontSize: '1.9rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Let’s steady you.
              </h1>
              <p className="t-body-sm mt-1">Hard moments happen. Pick one — it only takes a few minutes.</p>
            </header>

            {EXERCISES.map((e) => (
              <button key={e.id} onClick={() => setActive(e.id)}
                className="card-interactive w-full text-left flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: CALM_SOFT, color: CALM }}>
                    <WindIcon />
                  </span>
                  <div>
                    <p className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{e.title}</p>
                    <p className="t-caption mt-0.5">{e.sub}</p>
                  </div>
                </div>
                <span className="t-caption shrink-0">{e.time}</span>
              </button>
            ))}

            <p className="t-caption text-center pt-2" style={{ color: 'var(--text-muted)' }}>
              In real danger or crisis? This isn’t emergency help — reach a person you trust or a crisis line.
            </p>
          </div>
        ) : active === 'breath' ? (
          <Breathing onDone={() => setActive(null)} />
        ) : active === 'ground' ? (
          <Grounding onDone={() => setActive(null)} />
        ) : active === 'sigh' ? (
          <Sigh onDone={() => setActive(null)} />
        ) : active === 'name' ? (
          <GuidedSteps title="Name it to tame it" steps={NAME_STEPS} onDone={() => setActive(null)} doneLabel="Done" />
        ) : (
          <GuidedSteps title="Soften & settle" steps={SOFTEN_STEPS} onDone={() => setActive(null)} doneLabel="I feel steadier" />
        )}
      </div>
    </AppShell>
  )
}

function WindIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5M3 12h14a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2 2 0 1 1-2 2" />
    </svg>
  )
}

function ExitBtn({ onDone, label = 'I’m okay now' }) {
  return (
    <button onClick={onDone} className="btn-secondary w-full mt-6">{label}</button>
  )
}

// ── Paced breathing — animated circle synced to inhale / hold / exhale ─────────
const BREATH_PHASES = [
  { key: 'in', label: 'Breathe in', secs: 4, scale: 1 },
  { key: 'hold', label: 'Hold', secs: 4, scale: 1 },
  { key: 'out', label: 'Breathe out', secs: 6, scale: 0.58 },
]
const TARGET_CYCLES = 5

function Breathing({ onDone }) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [cycles, setCycles] = useState(0)
  const [running, setRunning] = useState(true)
  const [count, setCount] = useState(BREATH_PHASES[0].secs)
  const timer = useRef(null)
  const tick = useRef(null)
  const phase = BREATH_PHASES[phaseIdx]
  const done = cycles >= TARGET_CYCLES

  useEffect(() => {
    if (!running || done) return
    setCount(phase.secs)
    tick.current = setInterval(() => setCount((c) => (c > 1 ? c - 1 : c)), 1000)
    timer.current = setTimeout(() => {
      const nextIdx = (phaseIdx + 1) % BREATH_PHASES.length
      if (nextIdx === 0) setCycles((c) => c + 1)
      setPhaseIdx(nextIdx)
    }, phase.secs * 1000)
    return () => { clearTimeout(timer.current); clearInterval(tick.current) }
  }, [phaseIdx, running, done])

  return (
    <div className="animate-fade-in flex flex-col items-center pt-6" style={{ minHeight: '70vh' }}>
      <span className="label" style={{ color: CALM }}>Paced breathing</span>
      <div className="relative flex items-center justify-center my-10" style={{ width: 260, height: 260 }}>
        <span className="absolute rounded-full" style={{ width: 220, height: 220, background: CALM_SOFT, transform: `scale(${done ? 1 : phase.scale})`, transition: `transform ${phase.secs}s cubic-bezier(0.37,0,0.63,1)` }} />
        <span className="absolute rounded-full" style={{ width: 150, height: 150, background: 'rgba(92,127,121,0.22)', transform: `scale(${done ? 1 : phase.scale})`, transition: `transform ${phase.secs}s cubic-bezier(0.37,0,0.63,1)` }} />
        <div className="relative text-center">
          <p className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>{done ? 'Well done' : phase.label}</p>
          {!done && <p className="font-sans tabular-nums mt-1" style={{ fontSize: '2rem', fontWeight: 300, color: CALM }}>{count}</p>}
        </div>
      </div>

      {done ? (
        <>
          <p className="t-body-sm text-center" style={{ maxWidth: 280 }}>Notice how your body feels now, compared to a minute ago.</p>
          <div className="w-full max-w-xs mt-4 space-y-2">
            <button onClick={() => { setCycles(0); setPhaseIdx(0); setRunning(true) }} className="btn-secondary w-full">Again</button>
            <button onClick={onDone} className="btn-primary w-full" style={{ background: CALM }}>Done</button>
          </div>
        </>
      ) : (
        <>
          <p className="t-caption">{cycles + 1} of {TARGET_CYCLES}</p>
          <button onClick={onDone} className="btn-ghost mt-5">Stop</button>
        </>
      )}
    </div>
  )
}

// ── 5·4·3·2·1 grounding — sense-by-sense stepper ──────────────────────────────
const GROUND_STEPS = [
  { n: 5, sense: 'see', prompt: 'Name 5 things you can see.' },
  { n: 4, sense: 'feel', prompt: 'Notice 4 things you can feel — your feet, the chair, the air.' },
  { n: 3, sense: 'hear', prompt: 'Listen for 3 things you can hear.' },
  { n: 2, sense: 'smell', prompt: 'Find 2 things you can smell.' },
  { n: 1, sense: 'taste', prompt: 'Notice 1 thing you can taste.' },
]

function Grounding({ onDone }) {
  const [i, setI] = useState(0)
  const step = GROUND_STEPS[i]
  const last = i === GROUND_STEPS.length - 1

  return (
    <div className="animate-fade-in flex flex-col items-center pt-8" style={{ minHeight: '70vh' }}>
      <span className="label" style={{ color: CALM }}>5·4·3·2·1 grounding</span>
      <div className="w-28 h-28 rounded-full flex items-center justify-center my-8" style={{ background: CALM_SOFT }}>
        <span className="font-serif" style={{ fontSize: '3rem', fontWeight: 500, color: CALM }}>{step.n}</span>
      </div>
      <p className="font-serif text-center" style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, maxWidth: 300 }}>{step.prompt}</p>
      <p className="t-caption mt-2">Take your time. There’s no rush.</p>

      <div className="w-full max-w-xs mt-8 space-y-2">
        {last ? (
          <button onClick={onDone} className="btn-primary w-full" style={{ background: CALM }}>I’m back</button>
        ) : (
          <button onClick={() => setI((n) => n + 1)} className="btn-primary w-full" style={{ background: CALM }}>Next</button>
        )}
        <button onClick={onDone} className="btn-ghost w-full">Stop</button>
      </div>
      <div className="flex gap-1.5 mt-5">
        {GROUND_STEPS.map((_, n) => (
          <span key={n} className="h-1.5 rounded-full transition-all" style={{ width: n === i ? 20 : 6, background: n <= i ? CALM : 'rgba(92,127,121,0.25)' }} />
        ))}
      </div>
    </div>
  )
}

// ── Two calming sighs — double inhale + long exhale (physiological sigh) ───────
function Sigh({ onDone }) {
  const [round, setRound] = useState(0)
  const [label, setLabel] = useState('Get comfortable')
  const [big, setBig] = useState(false)
  const running = useRef(true)

  useEffect(() => {
    running.current = true
    let r = 0
    const seq = async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms))
      await wait(900)
      while (r < 3 && running.current) {
        setLabel('Breathe in…'); setBig(true); await wait(1500)
        setLabel('…and a little more'); await wait(900)
        setLabel('Slow breath out'); setBig(false); await wait(2600)
        r += 1; setRound(r)
      }
      if (running.current) setLabel('done')
    }
    seq()
    return () => { running.current = false }
  }, [])

  const done = label === 'done'
  return (
    <div className="animate-fade-in flex flex-col items-center pt-8" style={{ minHeight: '70vh' }}>
      <span className="label" style={{ color: CALM }}>Two calming sighs</span>
      <div className="relative flex items-center justify-center my-10" style={{ width: 240, height: 240 }}>
        <span className="absolute rounded-full" style={{ width: 200, height: 200, background: CALM_SOFT, transform: `scale(${done ? 1 : big ? 1 : 0.6})`, transition: 'transform 1.6s ease-in-out' }} />
        <p className="relative font-serif text-center px-6" style={{ fontSize: '1.3rem', fontWeight: 500, color: done ? 'var(--text-primary)' : CALM }}>
          {done ? 'That’s it.' : label}
        </p>
      </div>
      {done ? (
        <>
          <p className="t-body-sm text-center" style={{ maxWidth: 260 }}>A couple of long exhales tell your body it’s safe to come down.</p>
          <ExitBtn onDone={onDone} label="Done" />
        </>
      ) : (
        <>
          <p className="t-caption">Round {Math.min(round + 1, 3)} of 3</p>
          <button onClick={onDone} className="btn-ghost mt-5">Stop</button>
        </>
      )}
    </div>
  )
}

// ── Guided text steps — used by "Name it" and "Soften & settle" ───────────────
const NAME_STEPS = [
  { big: 'Notice', prompt: 'Turn toward the feeling instead of pushing it away. It’s allowed to be here.' },
  { big: 'Name it', prompt: 'Give it one word. Anxious? Angry? Small? Whatever fits — just one.' },
  { big: 'Locate it', prompt: 'Where do you feel it in your body? Put a hand there for a moment.' },
  { big: 'Let it move', prompt: 'Say to yourself: “This is here, and it will move through. I don’t have to fix it right now.”' },
]
const SOFTEN_STEPS = [
  { big: 'Jaw', prompt: 'Unclench your jaw. Let your teeth part and your tongue rest.' },
  { big: 'Shoulders', prompt: 'Drop your shoulders down, away from your ears.' },
  { big: 'Hands', prompt: 'Open your hands. Let them rest, palms soft.' },
  { big: 'Breath', prompt: 'One slow breath — let the exhale be a little longer than the inhale.' },
]

function GuidedSteps({ title, steps, onDone, doneLabel = 'Done' }) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1
  return (
    <div className="animate-fade-in flex flex-col items-center pt-8" style={{ minHeight: '70vh' }}>
      <span className="label" style={{ color: CALM }}>{title}</span>
      <div className="px-6 py-3 rounded-full my-8" style={{ background: CALM_SOFT }}>
        <span className="font-serif" style={{ fontSize: '1.4rem', fontWeight: 500, color: CALM }}>{step.big}</span>
      </div>
      <p className="font-serif text-center" style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35, maxWidth: 320 }}>{step.prompt}</p>
      <div className="w-full max-w-xs mt-8 space-y-2">
        {last ? (
          <button onClick={onDone} className="btn-primary w-full" style={{ background: CALM }}>{doneLabel}</button>
        ) : (
          <button onClick={() => setI((n) => n + 1)} className="btn-primary w-full" style={{ background: CALM }}>Next</button>
        )}
        <button onClick={onDone} className="btn-ghost w-full">Stop</button>
      </div>
      <div className="flex gap-1.5 mt-5">
        {steps.map((_, n) => (
          <span key={n} className="h-1.5 rounded-full transition-all" style={{ width: n === i ? 20 : 6, background: n <= i ? CALM : 'rgba(92,127,121,0.25)' }} />
        ))}
      </div>
    </div>
  )
}
