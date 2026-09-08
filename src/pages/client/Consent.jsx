import { useEffect, useState } from 'react'
import { linksAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Button, Spinner, EmptyState, formatDate } from '../../components/ui'

/*
 * Consent / sharing. Client sees therapist invites (pending -> Accept/Decline)
 * and active links (scope + Revoke).
 */
export default function Consent() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  function load() {
    linksAPI
      .me()
      .then((res) => setLinks(res.data.links || []))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function accept(id) {
    setBusy(id)
    try {
      await linksAPI.consent(id)
      load()
    } finally {
      setBusy(null)
    }
  }

  async function revoke(id) {
    setBusy(id)
    try {
      await linksAPI.revoke(id)
      load()
    } finally {
      setBusy(null)
    }
  }

  const pending = links.filter((l) => l.consent_state === 'pending')
  const active = links.filter((l) => l.consent_state === 'active')

  return (
    <AppShell theme="client">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Sharing</h1>
      <p className="uc-secondary mb-5">
        You decide what your therapist can see. You can change this any time.
      </p>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner size={26} />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          title="No therapist linked yet"
          body="When your therapist invites you, the request will appear here for you to accept."
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <span className="uc-label">Invitations</span>
              <div className="mt-2 space-y-3">
                {pending.map((l) => (
                  <Card key={l.id} accent>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>
                      {l.therapist_name || l.therapist_email}
                    </p>
                    {l.practice_name && <p className="uc-muted text-sm">{l.practice_name}</p>}
                    <p className="uc-secondary text-sm mt-2">
                      wants to connect so they can support you between sessions.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="primary"
                        className="uc-btn--sm"
                        disabled={busy === l.id}
                        onClick={() => accept(l.id)}
                      >
                        {busy === l.id ? <Spinner size={14} /> : 'Accept'}
                      </Button>
                      <button
                        className="uc-btn uc-btn--danger uc-btn--sm"
                        disabled={busy === l.id}
                        onClick={() => revoke(l.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {active.length > 0 && (
            <div>
              <span className="uc-label">Active connections</span>
              <div className="mt-2 space-y-3">
                {active.map((l) => (
                  <Card key={l.id}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold" style={{ color: 'var(--text)' }}>
                        {l.therapist_name || l.therapist_email}
                      </p>
                      <span className="uc-badge uc-badge--good">connected</span>
                    </div>
                    {l.practice_name && <p className="uc-muted text-sm">{l.practice_name}</p>}
                    {l.consent_scope && (
                      <p className="uc-secondary text-sm mt-2">
                        Sharing: <strong>{l.consent_scope}</strong>
                      </p>
                    )}
                    <p className="uc-muted text-xs mt-1">Connected {formatDate(l.consented_at)}</p>
                    <div className="mt-3">
                      <button
                        className="uc-btn uc-btn--danger uc-btn--sm"
                        disabled={busy === l.id}
                        onClick={() => revoke(l.id)}
                      >
                        {busy === l.id ? <Spinner size={14} /> : 'Revoke sharing'}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
