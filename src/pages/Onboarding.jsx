import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { authAPI, clientAPI, invitationsAPI } from '../services/api'
import { useApp } from '../context/AppContext'
import AuthLayout from './authShared'
import { Button, Textarea, Spinner, Card } from '../components/ui'
import { canPromptInstall, promptInstall, isIOS, isStandalone, onInstallAvailabilityChange } from '../lib/pwa'

/*
 * Onboarding.
 * - Therapist: unchanged workspace-intro flow (real therapist onboarding lives in
 *   the dashboard, Task 11). Runs post-auth.
 * - Client: CODE-FIRST wizard. No valid therapist invitation code = no onboarding.
 *   Runs pre-auth (code → welcome → create account → set up → privacy → confirm
 *   therapist → first check-in → ready). The invitation link carries ?code=XXXX.
 */
export default function Onboarding() {
  const { isTherapist } = useApp()
  // NOTE: the "already onboarded → go home" redirect now lives INSIDE the client
  // wizard, guarded so it never fires mid-redeem (an existing client accepting a
  // NEW therapist's invite is already onboarded, but must stay to connect).
  if (isTherapist) return <TherapistOnboarding />
  return <ClientInviteWizard />
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT — code-first invitation wizard
// ─────────────────────────────────────────────────────────────────────────────
const STAGES = ['code', 'install', 'welcome', 'account', 'setup', 'privacy', 'confirm', 'checkin', 'ready']

function ClientInviteWizard() {
  const navigate = useNavigate()
  const { login, refreshProfile, isAuthenticated, authChecked, profile } = useApp()
  const [params] = useSearchParams()
  const [stage, setStage] = useState('code')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already-onboarded client who landed here with NOTHING to redeem → home.
  // Guarded to stage 'code' with no code, so it never fires once an invite flow
  // is underway (an existing client accepting a NEW therapist's invite is already
  // onboarded but must stay in the wizard to connect).
  useEffect(() => {
    if (authChecked && isAuthenticated && profile?.onboarding_completed
        && stage === 'code' && !code && !params.get('code')) {
      navigate('/home', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isAuthenticated, profile, stage])

  // invitation
  const [code, setCode] = useState((params.get('code') || '').toUpperCase())
  const [therapist, setTherapist] = useState(null)
  // account
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [existing, setExisting] = useState(false) // invited person already had an Unclinq account
  // first check-in
  const [feeling, setFeeling] = useState('')
  const [firstThought, setFirstThought] = useState('')
  // PWA install is required to continue (with a manual fallback where no prompt exists).
  const [installed, setInstalled] = useState(() => isStandalone())

  const go = (s) => { setError(''); setStage(s) }

  // Auto-validate a code carried by the invitation link.
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current) return
    autoTried.current = true
    const c = (params.get('code') || '').trim()
    if (c) validateCode(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function validateCode(raw) {
    const c = String(raw || code).trim().toUpperCase()
    if (c.length < 4) { setError('Enter the code your therapist shared.'); return }
    setBusy(true); setError('')
    try {
      const res = await invitationsAPI.validate(c)
      setCode(c)
      setTherapist(res.data.therapist)
      go('install')
    } catch (err) {
      const reason = err.response?.data?.reason
      setError(reason === 'expired' ? 'That invitation has expired — ask your therapist for a new one.'
        : reason === 'accepted' ? 'That invitation has already been used.'
        : reason === 'revoked' ? 'That invitation was withdrawn.'
        : 'That code isn’t valid. Check it and try again.')
    } finally { setBusy(false) }
  }

  async function createAccount() {
    setBusy(true); setError('')
    try {
      if (!otpSent) {
        if (!name.trim() || !email.trim()) { setError('Add your name and email.'); setBusy(false); return }
        await authAPI.sendOtp(email.trim(), 'register')
        setOtpSent(true)
      } else {
        const res = await authAPI.verifyOtp(email.trim(), otp.trim(), 'register', name.trim(), 'client')
        login(res.data.token, res.data.user)
        // Existing Unclinq account (e.g. already a client of another therapist, or a
        // B2C user): skip the new-account setup + first check-in, go straight to
        // consent → connect. New accounts get the full setup flow.
        if (res.data.is_new_user === false) { setExisting(true); go('privacy') }
        else go('setup')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not verify. Check the code and try again.')
    } finally { setBusy(false) }
  }

  async function connectTherapist() {
    setBusy(true); setError('')
    try {
      await invitationsAPI.redeem(code)
      go(existing ? 'ready' : 'checkin')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not connect. Please try again.')
    } finally { setBusy(false) }
  }

  async function finish() {
    setBusy(true); setError('')
    try {
      if (firstThought.trim() || feeling) {
        await clientAPI.addEvent({ reflection: firstThought.trim() || undefined, primary_emotion: feeling || undefined }).catch(() => {})
      }
      await authAPI.completeOnboarding()
      await refreshProfile()
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not finish. Please try again.')
      setBusy(false)
    }
  }

  const stepIndex = STAGES.indexOf(stage)

  return (
    <div data-theme="client" data-mode="light" className="min-h-dvh flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="flex-1 w-full max-w-lg mx-auto px-6 py-8 font-sans flex flex-col">
        {/* progress */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STAGES.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full transition-all"
              style={{ width: i === stepIndex ? 20 : 6, background: i <= stepIndex ? 'var(--sp)' : 'rgba(var(--hairline-rgb),0.5)' }} />
          ))}
        </div>

        <div className="flex-1">
          {stage === 'code' && (
            <Stage label="Invitation" title="You’ve been invited to Unclinq.">
              <p className="t-body-sm">Enter the invitation code your therapist shared with you to get started.</p>
              <input className="input-field mt-4 text-center tracking-[0.3em] font-semibold" style={{ fontSize: 22, textTransform: 'uppercase' }}
                placeholder="X7K2P9" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <PrimaryBtn busy={busy} onClick={() => validateCode()}>Continue</PrimaryBtn>
              <p className="t-caption text-center mt-3">Don’t have a code? Ask your therapist for an invitation.</p>
            </Stage>
          )}

          {stage === 'install' && (
            <Stage label={`Invitation from ${therapist?.name || 'your therapist'}`} title="You’re invited.">
              <TherapistCard t={therapist} />
              <InstallPrompt onInstalled={() => setInstalled(true)} installed={installed} />
              <PrimaryBtn onClick={() => go('welcome')} disabled={!installed}>Continue</PrimaryBtn>
              {!installed && <p className="t-caption text-center mt-2">Add Unclinq to your home screen to continue.</p>}
            </Stage>
          )}

          {stage === 'welcome' && (
            <Stage label="Welcome" title="Therapy doesn’t stop when the session ends.">
              <p className="t-body-sm">Unclinq helps you make sense of your week and stay connected to what you’re working on in therapy — it’s part of your care, not another app to keep up with.</p>
              <PrimaryBtn onClick={() => go('account')}>Get started</PrimaryBtn>
            </Stage>
          )}

          {stage === 'account' && (
            <Stage label="Create your space" title="Create your account.">
              {!otpSent ? (
                <>
                  <Field label="First name" value={name} onChange={setName} placeholder="Your name" />
                  <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
                  <PrimaryBtn busy={busy} onClick={createAccount}>Send code</PrimaryBtn>
                  <p className="t-caption text-center mt-3">We’ll email you a 6-digit code to confirm it’s you.</p>
                </>
              ) : (
                <>
                  <p className="t-body-sm">We sent a 6-digit code to <b>{email}</b>.</p>
                  <input className="input-field mt-3 text-center tracking-[0.3em] font-semibold" style={{ fontSize: 20 }}
                    placeholder="••••••" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
                  <PrimaryBtn busy={busy} onClick={createAccount}>Verify &amp; continue</PrimaryBtn>
                  <button className="btn-ghost w-full mt-2" onClick={() => { setOtpSent(false); setOtp('') }}>Use a different email</button>
                </>
              )}
            </Stage>
          )}

          {stage === 'setup' && (
            <Stage label="Set up your space" title="Let’s make this yours.">
              <Field label="What should we call you?" value={name} onChange={setName} placeholder="Your name" />
              <p className="t-caption mt-2">You can add more later. Keep it light for now.</p>
              <PrimaryBtn busy={busy} onClick={async () => { await authAPI.updateSettings({ name: name.trim() }).catch(() => {}); go('privacy') }}>Continue</PrimaryBtn>
            </Stage>
          )}

          {stage === 'privacy' && (
            <Stage label="Privacy & sharing" title="Your space is private.">
              <p className="t-body-sm">Your reflections and conversations are personal. Unclinq helps you capture and understand what happens between your therapy sessions.</p>
              <div className="card mt-3" style={{ background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
                <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>Because you were invited by your therapist, a summary of your activity may be shared with them to help prepare for your sessions. <b>We’ll always show you what’s shared.</b></p>
              </div>
              <PrimaryBtn onClick={() => go('confirm')}>I understand</PrimaryBtn>
            </Stage>
          )}

          {stage === 'confirm' && (
            <Stage label="Confirm connection" title="You’re connecting with">
              <TherapistCard t={therapist} />
              <p className="t-body-sm mt-3">By continuing, you’ll connect this Unclinq space with your therapist.</p>
              <PrimaryBtn busy={busy} onClick={connectTherapist}>Connect &amp; continue</PrimaryBtn>
            </Stage>
          )}

          {stage === 'checkin' && (
            <Stage label="First check-in" title="Let’s start with today.">
              <p className="label" style={{ color: 'var(--text-secondary)' }}>How are you feeling right now?</p>
              <div className="flex gap-2 flex-wrap mt-2">
                {['okay', 'anxious', 'low', 'hopeful', 'tired', 'overwhelmed'].map((m) => (
                  <button key={m} onClick={() => setFeeling(m)}
                    className={feeling === m ? 'btn-primary' : 'btn-secondary'} style={{ minHeight: 38, padding: '6px 14px', fontSize: 13 }}>{m}</button>
                ))}
              </div>
              <div className="mt-4">
                <p className="label" style={{ color: 'var(--text-secondary)' }}>What’s been on your mind?</p>
                <textarea className="input-field mt-2" style={{ minHeight: 96, resize: 'vertical' }}
                  placeholder="Anything at all — a moment, a worry, a small win…" value={firstThought} onChange={(e) => setFirstThought(e.target.value)} />
              </div>
              <PrimaryBtn busy={busy} onClick={() => go('ready')}>Save & continue</PrimaryBtn>
              <button className="btn-ghost w-full mt-2" onClick={() => go('ready')}>Skip for now</button>
            </Stage>
          )}

          {stage === 'ready' && (
            <Stage label="You’re all set" title="You’re ready.">
              <p className="t-body-sm">From here, Unclinq helps you capture what happens between sessions, reflect when you need to, and bring what matters into your therapy journey.</p>
              <PrimaryBtn busy={busy} onClick={finish}>Go to my space</PrimaryBtn>
            </Stage>
          )}
        </div>

        {error && <p className="text-sm text-center mt-3" style={{ color: '#B0332F' }}>{error}</p>}
      </div>
    </div>
  )
}

function Stage({ label, title, children }) {
  return (
    <div className="animate-fade-in">
      <span className="label" style={{ color: 'var(--sp-text)' }}>{label}</span>
      <h1 className="font-serif tracking-tight mt-1 mb-3" style={{ fontSize: '1.9rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</h1>
      {children}
    </div>
  )
}
function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block mt-3">
      <span className="label">{label}</span>
      <input className="input-field mt-1.5" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
function PrimaryBtn({ children, onClick, busy, disabled }) {
  return (
    <button className="btn-primary w-full mt-5 flex items-center justify-center" style={{ display: 'flex', opacity: disabled ? 0.5 : 1 }} onClick={onClick} disabled={busy || disabled}>
      {busy ? <Spinner size={16} /> : children}
    </button>
  )
}
function TherapistCard({ t }) {
  if (!t) return null
  return (
    <div className="card flex items-center gap-3">
      <span className="w-12 h-12 rounded-full flex items-center justify-center font-serif shrink-0" style={{ background: 'var(--sp)', color: '#fff', fontSize: 20 }}>
        {(t.name || 'T').charAt(0)}
      </span>
      <div className="min-w-0">
        <p className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{t.name}</p>
        {t.credentials && <p className="t-caption">{t.credentials}</p>}
        {t.practice_name && <p className="t-caption">{t.practice_name}</p>}
      </div>
    </div>
  )
}

// PWA "Add to Home Screen" — shown right after the code validates.
function InstallPrompt({ onInstalled, installed }) {
  const [, force] = useState(0)
  useEffect(() => onInstallAvailabilityChange(() => force((n) => n + 1)), [])
  useEffect(() => { if (isStandalone()) onInstalled?.() }, []) // already installed → satisfied
  // eslint-disable-next-line react-hooks/exhaustive-deps

  if (installed || isStandalone()) {
    return (
      <div className="card mt-4" style={{ background: 'var(--sp-light)', borderColor: 'var(--sp-border)' }}>
        <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>✓ Added to your home screen — you’re set.</p>
      </div>
    )
  }
  return (
    <div className="card mt-4">
      <p className="label" style={{ color: 'var(--sp-text)' }}>Add Unclinq to your home screen</p>
      <p className="t-body-sm mt-1">Unclinq works best as an app on your home screen — please add it to continue.</p>
      {canPromptInstall() ? (
        <button className="btn-secondary w-full mt-3" onClick={async () => { const r = await promptInstall(); if (r === 'accepted') onInstalled?.() }}>Add to home screen</button>
      ) : isIOS() ? (
        <>
          <p className="t-caption mt-2">On iPhone: tap the <b>Share</b> icon, then <b>Add to Home Screen</b>.</p>
          <button className="btn-secondary w-full mt-3" onClick={() => onInstalled?.()}>I’ve added it</button>
        </>
      ) : (
        <>
          <p className="t-caption mt-2">Use your browser menu → <b>Install / Add to Home screen</b>.</p>
          <button className="btn-secondary w-full mt-3" onClick={() => onInstalled?.()}>I’ve added it</button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// THERAPIST — unchanged workspace-intro (full 11-step onboarding is Task 11)
// ─────────────────────────────────────────────────────────────────────────────
function TherapistOnboarding() {
  const { profile, refreshProfile } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function finish() {
    setSaving(true); setError('')
    try {
      await authAPI.completeOnboarding()
      await refreshProfile()
      navigate('/t', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not continue. Please try again.')
      setSaving(false)
    }
  }

  const steps = therapistSteps()
  const isLast = step === steps.length - 1
  const current = steps[step]

  return (
    <AuthLayout title="Welcome to Unclinq" subtitle={current.subtitle}>
      <div className="space-y-4">
        <div className="min-h-[220px]">{current.body}</div>
        {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>Back</Button>}
          {isLast ? (
            <Button variant="primary" className="flex-1" onClick={finish} disabled={saving}>
              {saving ? <Spinner size={16} /> : 'Go to my dashboard'}
            </Button>
          ) : (
            <Button variant="primary" className="flex-1" onClick={() => setStep((s) => s + 1)}>Continue</Button>
          )}
        </div>
        <div className="flex justify-center gap-1.5 pt-1">
          {steps.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 20 : 6, background: i === step ? 'var(--accent)' : 'var(--border-strong)' }} />
          ))}
        </div>
      </div>
    </AuthLayout>
  )
}

function Bullets({ items }) {
  return (
    <ul className="space-y-2 mt-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <span style={{ color: 'var(--accent)' }}>•</span><span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function therapistSteps() {
  return [
    {
      subtitle: 'Continuity of care between sessions — with you as the clinical anchor.',
      body: (
        <div>
          <p style={{ color: 'var(--text)' }}>Unclinq turns the messy activity around therapy into the small amount of context you actually need — at the right moment.</p>
          <p className="uc-secondary text-sm mt-2">You can add your practice details anytime in Settings.</p>
        </div>
      ),
    },
    {
      subtitle: 'How the loop works.',
      body: (
        <div className="text-sm font-mono leading-relaxed p-3 rounded-xl" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Before session → Briefing<br />&nbsp;&nbsp;↓<br />Record session → AI draft summary<br />&nbsp;&nbsp;↓<br />You approve + assign an action<br />&nbsp;&nbsp;↓<br />Client uses Unclinq between sessions<br />&nbsp;&nbsp;↓<br />Next session briefing → repeat
        </div>
      ),
    },
    {
      subtitle: 'What Unclinq needs from you — and what it does not.',
      body: (
        <div className="space-y-3 text-sm">
          <div><p className="uc-label">You don’t need to</p><Bullets items={['Monitor the client', 'Respond to their AI conversations', 'Read every journal entry', 'Hand-write reports']} /></div>
          <div><p className="uc-label">You do</p><Bullets items={['Set the therapeutic context', 'Run your sessions', 'Review AI-drafted summaries and approve them', 'Assign the next action', 'Read the briefing before the next session']} /></div>
        </div>
      ),
    },
    {
      subtitle: 'Privacy, AI and recordings.',
      body: (
        <div className="text-sm">
          <Bullets items={[
            'Everything is consent-gated: you see a client only after they accept your invite.',
            'AI-extracted understanding is a draft — durable only when you approve it.',
            'Session audio is transcribed and not stored; only the summary you approve is kept.',
            'All content is provenance-labelled (therapist / client / AI) end-to-end.',
          ]} />
        </div>
      ),
    },
    {
      subtitle: 'Add your first client.',
      body: (
        <div>
          <p style={{ color: 'var(--text)' }}>From your dashboard, generate an invitation — your client gets a link and a unique code, creates their own account, and connects to you.</p>
          <Bullets items={['Generate invitation → they redeem the code → you’re connected', 'Set the current focus and techniques (a light context)', 'Then record or review the first session']} />
        </div>
      ),
    },
  ]
}
