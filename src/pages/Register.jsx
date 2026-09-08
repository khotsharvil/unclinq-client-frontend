import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { authAPI } from '../services/api'
import { useApp } from '../context/AppContext'
import { Button, Spinner } from '../components/ui'
import AuthLayout, { GoogleButton } from './authShared'

/*
 * Register: choose a role, enter email -> send code -> enter code + name -> verified.
 */
export default function Register() {
  const { login, isAuthenticated, role: currentRole } = useApp()

  const [role, setRole] = useState('client')
  const [step, setStep] = useState('email') // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      setError('')
      try {
        const res = await authAPI.googleAuth(tokenResponse.access_token, role)
        login(res.data.token, res.data.user)
      } catch (err) {
        setError(err.response?.data?.error || 'Google sign-in failed. Try again.')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => setError('Google sign-in failed. Try again.'),
  })

  if (isAuthenticated) {
    return <Navigate to={currentRole === 'therapist' ? '/t' : '/home'} replace />
  }

  async function sendCode(e) {
    e?.preventDefault()
    if (!email.trim()) return setError('Enter your email address.')
    setError('')
    setLoading(true)
    try {
      await authAPI.sendOtp(email.trim(), 'register')
      setStep('otp')
      setCooldown(60)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verify(e) {
    e?.preventDefault()
    if (otp.trim().length < 4) return
    if (!name.trim()) return setError('Please tell us your name.')
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.verifyOtp(email.trim(), otp.trim(), 'register', name.trim(), role)
      login(res.data.token, res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account."
      subtitle="Continuity of care, between sessions."
    >
      {step === 'email' ? (
        <>
          <div className="mb-5">
            <span className="uc-label">I am a…</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { key: 'client', label: 'Client', hint: 'I see a therapist' },
                { key: 'therapist', label: 'Therapist', hint: 'I see clients' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRole(opt.key)}
                  className="text-left p-3 rounded-xl border transition-all"
                  style={{
                    borderColor: role === opt.key ? 'var(--accent)' : 'var(--border)',
                    background: role === opt.key ? 'var(--accent-soft)' : 'var(--surface)',
                  }}
                >
                  <span className="font-semibold block">{opt.label}</span>
                  <span className="uc-muted text-xs">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={sendCode} className="space-y-4">
            <label className="block">
              <span className="uc-label">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                className="uc-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
              />
            </label>
            {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
            <Button variant="primary" className="uc-btn--block" disabled={loading || !email.trim()}>
              {loading ? <Spinner size={16} /> : 'Send code'}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="uc-muted text-xs">or</span>
            <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <GoogleButton loading={googleLoading} onClick={() => googleLogin()} />
        </>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <button
            type="button"
            className="uc-btn uc-btn--ghost uc-btn--sm"
            onClick={() => {
              setStep('email')
              setOtp('')
              setError('')
            }}
          >
            ← Back
          </button>
          <p className="uc-secondary text-sm">
            We sent a code to <strong>{email}</strong>.
          </p>
          <label className="block">
            <span className="uc-label">Your name</span>
            <input
              className="uc-input"
              placeholder="First name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="uc-label">6-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="uc-input tracking-[0.4em] text-center text-lg"
              placeholder="••••••"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                setError('')
              }}
            />
          </label>
          {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
          <Button variant="primary" className="uc-btn--block" disabled={loading || otp.length < 4}>
            {loading ? <Spinner size={16} /> : 'Create account'}
          </Button>
          <div className="text-center">
            {cooldown > 0 ? (
              <span className="uc-muted text-sm">Resend in {cooldown}s</span>
            ) : (
              <button type="button" className="text-sm font-semibold" style={{ color: 'var(--accent)' }} onClick={sendCode}>
                Resend code
              </button>
            )}
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm uc-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold" style={{ color: 'var(--accent)' }}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
