import { useState, useEffect } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { authAPI } from '../services/api'
import { useApp } from '../context/AppContext'
import { Button, Spinner } from '../components/ui'
import AuthLayout, { GoogleButton } from './authShared'

export default function Login() {
  const { login, isAuthenticated, role } = useApp()
  const navigate = useNavigate()

  const [step, setStep] = useState('email') // 'email' | 'otp'
  const [email, setEmail] = useState('')
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
        const res = await authAPI.googleAuth(tokenResponse.access_token)
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
    return <Navigate to={role === 'therapist' ? '/t' : '/home'} replace />
  }

  async function sendCode(e) {
    e?.preventDefault()
    if (!email.trim()) return setError('Enter your email address.')
    setError('')
    setLoading(true)
    try {
      await authAPI.sendOtp(email.trim(), 'login')
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
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.verifyOtp(email.trim(), otp.trim(), 'login')
      login(res.data.token, res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Try again.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back." subtitle="Your work is still here.">
      {step === 'email' ? (
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
            {loading ? <Spinner size={16} /> : 'Verify & sign in'}
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

      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="uc-muted text-xs">or</span>
        <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      <GoogleButton loading={googleLoading} onClick={() => googleLogin()} />

      <p className="mt-6 text-center text-sm uc-secondary">
        New here?{' '}
        <Link to="/register" className="font-semibold" style={{ color: 'var(--accent)' }}>
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link to="/forgot-password" className="uc-muted">
          Forgot password?
        </Link>
      </p>
    </AuthLayout>
  )
}
