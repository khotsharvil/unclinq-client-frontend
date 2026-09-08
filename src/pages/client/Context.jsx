import { useEffect, useState } from 'react'
import { clientAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Spinner, ProvenanceBadge, EmptyState } from '../../components/ui'

const KIND_LABELS = {
  client_concern: 'Concerns',
  theme: 'Themes',
  goal: 'Goals',
  intervention: 'Interventions',
  therapist_guidance: 'Guidance from your therapist',
  agreed_action: 'Agreed actions',
}

/*
 * "What Emora remembers" — grouped by provenance so therapist-authored context
 * is prominent (a core product requirement).
 */
export default function Context() {
  const [memory, setMemory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clientAPI
      .context()
      .then((res) => setMemory(res.data.memory || []))
      .catch(() => setMemory([]))
      .finally(() => setLoading(false))
  }, [])

  // Provenance order: therapist first (prominent), then client, then AI.
  const order = { therapist_authored: 0, client_generated: 1, ai_generated: 2 }
  const groups = {
    therapist_authored: [],
    client_generated: [],
    ai_generated: [],
  }
  for (const m of memory) {
    ;(groups[m.provenance] || (groups[m.provenance] = [])).push(m)
  }
  const provenanceKeys = Object.keys(groups)
    .filter((k) => groups[k].length)
    .sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9))

  const GROUP_TITLE = {
    therapist_authored: 'From your therapist',
    client_generated: 'From you',
    ai_generated: 'Emora noticed',
  }

  return (
    <AppShell theme="client">
      <h1 className="text-2xl font-bold tracking-tight mb-1">What Emora remembers</h1>
      <p className="uc-secondary mb-5">
        The context you and your therapist share. Nothing here is a diagnosis — it's what's been noticed.
      </p>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner size={26} />
        </div>
      ) : memory.length === 0 ? (
        <EmptyState
          title="Nothing remembered yet"
          body="As you work with Emora and your therapist, shared context will collect here."
        />
      ) : (
        <div className="space-y-6">
          {provenanceKeys.map((prov) => (
            <div key={prov}>
              <div className="flex items-center gap-2 mb-2">
                <ProvenanceBadge provenance={prov} label={GROUP_TITLE[prov]} />
              </div>
              <div className="space-y-2">
                {groups[prov].map((m, i) => (
                  <Card key={i} accent={prov === 'therapist_authored'} className="py-3">
                    <span className="uc-label">{KIND_LABELS[m.kind] || m.kind}</span>
                    <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{m.content}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
