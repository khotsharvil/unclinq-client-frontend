import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useApp } from '../context/AppContext'
import AppShell from '../components/AppShell'
import { Card, Button, Spinner } from '../components/ui'
import { pushSupported, isSubscribed, enablePush, disablePush } from '../lib/push'

/*
 * Settings — shared by both roles. Therapists also edit display_name,
 * credentials, and practice_name.
 */
export default function Settings() {
  const { profile, logout, updateProfile, isTherapist, mode, setMode } = useApp()
  const navigate = useNavigate()

  const [name, setName] = useState(profile?.name || '')
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [credentials, setCredentials] = useState(profile?.credentials || '')
  const [practiceName, setPracticeName] = useState(profile?.practice_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushErr, setPushErr] = useState('')
  useEffect(() => { isSubscribed().then(setPushOn).catch(() => {}) }, [])

  async function togglePush() {
    setPushBusy(true)
    setPushErr('')
    try {
      if (pushOn) { await disablePush(); setPushOn(false) }
      else { await enablePush(); setPushOn(true) }
    } catch (err) {
      setPushErr(err.message || 'Could not update notifications.')
    } finally { setPushBusy(false) }
  }

  async function exportData() {
    setExporting(true)
    setError('')
    try {
      const res = await authAPI.exportData()
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `unclinq-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not export your data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const payload = { name: name.trim() }
      if (isTherapist) {
        payload.display_name = displayName.trim()
        payload.credentials = credentials.trim()
        payload.practice_name = practiceName.trim()
      }
      const res = await authAPI.updateSettings(payload)
      updateProfile(res.data?.user || payload)
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    setDeleting(true)
    try {
      await authAPI.deleteAccount('DELETE')
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete account.')
      setDeleting(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell theme={isTherapist ? 'therapist' : 'client'}>
      <h1 className="text-2xl font-bold tracking-tight mb-5">Settings</h1>

      <div className="max-w-lg space-y-6">
        <Card className="space-y-4">
          <span className="uc-label">Profile</span>
          <label className="block">
            <span className="uc-label">Name</span>
            <input className="uc-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          {isTherapist && (
            <>
              <label className="block">
                <span className="uc-label">Display name (shown to clients)</span>
                <input
                  className="uc-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dr. Rao"
                />
              </label>
              <label className="block">
                <span className="uc-label">Credentials</span>
                <input
                  className="uc-input"
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                  placeholder="e.g. Clinical Psychologist, M.Phil"
                />
              </label>
              <label className="block">
                <span className="uc-label">Practice name</span>
                <input
                  className="uc-input"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  placeholder="e.g. Still Waters Therapy"
                />
              </label>
            </>
          )}

          {error && <p className="text-sm" style={{ color: '#B0332F' }}>{error}</p>}
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? <Spinner size={16} /> : 'Save changes'}
            </Button>
            {saved && <span className="uc-badge uc-badge--good">Saved</span>}
          </div>
        </Card>

        <Card>
          <span className="uc-label">Account</span>
          <p className="uc-secondary text-sm mt-1">{profile?.email}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </Card>

        {isTherapist && (
          <Card>
            <span className="uc-label">Billing & plan</span>
            <p className="uc-secondary text-sm mt-1">Manage your subscription and client seats.</p>
            <div className="mt-3">
              <Button variant="secondary" to="/t/billing">Manage billing</Button>
            </div>
          </Card>
        )}

        <Card>
          <span className="uc-label">Appearance</span>
          <p className="uc-secondary text-sm mt-1">Choose how Unclinq looks on this device.</p>
          <div className="mt-3 inline-flex rounded-xl p-1" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
            {['light', 'dark'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="uc-btn--sm px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors"
                style={mode === m
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'transparent', color: 'var(--text-secondary)' }}
              >
                {m}
              </button>
            ))}
          </div>
        </Card>

        {pushSupported() && (
          <Card>
            <span className="uc-label">Notifications</span>
            <p className="uc-secondary text-sm mt-1">
              {isTherapist
                ? 'Get a push notification when a client signal needs your attention.'
                : 'Get a gentle push when there’s something new for you.'}
            </p>
            {pushErr && <p className="text-sm mt-2" style={{ color: '#B0332F' }}>{pushErr}</p>}
            <div className="mt-3">
              <Button variant={pushOn ? 'secondary' : 'primary'} onClick={togglePush} disabled={pushBusy}>
                {pushBusy ? <Spinner size={16} /> : pushOn ? 'Turn off notifications' : 'Enable notifications'}
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <span className="uc-label">Your data</span>
          <p className="uc-secondary text-sm mt-1">
            Download a copy of everything Unclinq holds about you — your profile, sessions,
            notes, exercises and activity — as a JSON file.
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={exportData} disabled={exporting}>
              {exporting ? <Spinner size={16} /> : 'Download my data'}
            </Button>
          </div>
        </Card>

        <Card>
          <span className="uc-label">Danger zone</span>
          {!confirmDelete ? (
            <div className="mt-2">
              <button className="uc-btn uc-btn--danger uc-btn--sm" onClick={() => setConfirmDelete(true)}>
                Delete my account
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <p className="uc-secondary text-sm">
                This permanently deletes your account and data. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button className="uc-btn uc-btn--danger uc-btn--sm" disabled={deleting} onClick={doDelete}>
                  {deleting ? <Spinner size={14} /> : 'Yes, delete everything'}
                </button>
                <button className="uc-btn uc-btn--ghost uc-btn--sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
