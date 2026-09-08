import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { Button, Spinner } from '../components/ui'
import AuthLayout from './authShared'

function useQueryToken() {
  // HashRouter puts params after the hash, e.g. #/reset-password?token=abc
  const hash = window.location.hash
  const qi = hash.indexOf('?')
  const params = new URLSearchParams(qi >= 0 ? hash.slice(qi + 1) : '')
  return params.get('token') || ''
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [token, setToken] = useState(useQueryToken)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authAPI.resetPassword(token.trim(), password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password.">
      {done ? (
        <div className="space-y-4">
          <p className="uc-secondary">Password updated. Taking you to sign in…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {!useQueryToken() && (
            <label className="block">
              <span className="uc-label">Reset token</span>
              <input
                className="uc-input"
                placeholder="Paste your reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          )}
          <label className="block">
            <span className="uc-label">New password</span>
            <input
              type="password"
              required
              minLength={8}
              className="uc-input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
          <Button variant="primary" className="uc-btn--block" disabled={loading || !token || password.length < 8}>
            {loading ? <Spinner size={16} /> : 'Update password'}
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="uc-muted">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
