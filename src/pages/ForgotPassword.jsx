import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { Button, Spinner } from '../components/ui'
import AuthLayout from './authShared'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authAPI.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset your password." subtitle="We'll email you a reset link.">
      {sent ? (
        <div className="space-y-4">
          <p className="uc-secondary">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </p>
          <Button to="/login" variant="secondary" className="uc-btn--block">
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="uc-label">Email</span>
            <input
              type="email"
              required
              className="uc-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
          <Button variant="primary" className="uc-btn--block" disabled={loading || !email.trim()}>
            {loading ? <Spinner size={16} /> : 'Send reset link'}
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
