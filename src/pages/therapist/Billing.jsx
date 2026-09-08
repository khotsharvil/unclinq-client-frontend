import { useEffect, useState } from 'react'
import { billingAPI } from '../../services/api'
import AppShell from '../../components/AppShell'
import { Card, Button, Spinner } from '../../components/ui'

/*
 * Billing — therapist-pays B2B seat model. A plan grants N seats = max active
 * clients. Checkout runs through Razorpay when configured; otherwise the page
 * still shows the plan/usage and explains payments aren't enabled yet.
 */
export default function Billing() {
  const [sub, setSub] = useState(null)
  const [plans, setPlans] = useState([])
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  function load() {
    Promise.all([billingAPI.subscription(), billingAPI.plans()])
      .then(([s, p]) => {
        setSub(s.data)
        setPlans(p.data.plans || [])
        setConfigured(p.data.configured)
      })
      .catch(() => setMsg('Could not load billing.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function choose(planId) {
    setBusy(planId)
    setMsg('')
    try {
      const res = await billingAPI.createOrder(planId)
      // With Razorpay configured, res.data.order + key_id would open Checkout here.
      // (Razorpay Checkout script integration is added when live keys exist.)
      setMsg(`Order created for the ${planId} plan. Complete payment to activate ${res.data.order?.amount ? '₹' + (res.data.order.amount / 100) : ''}.`)
    } catch (err) {
      setMsg(err.response?.data?.error || 'Could not start checkout.')
    } finally { setBusy('') }
  }

  if (loading) {
    return <AppShell theme="therapist"><div className="py-16 flex justify-center"><Spinner size={26} /></div></AppShell>
  }

  const used = sub?.usage?.used ?? 0
  const seats = sub?.usage?.seats ?? 1
  const plan = sub?.subscription?.plan || 'free'

  return (
    <AppShell theme="therapist">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Billing</h1>
      <p className="uc-secondary mb-5">Your plan sets how many active clients you can support at once.</p>

      <Card className="mb-5 max-w-lg">
        <span className="uc-label">Current plan</span>
        <div className="flex items-center justify-between mt-1">
          <p className="text-lg font-bold capitalize" style={{ color: 'var(--text)' }}>{plan}</p>
          <span className="uc-secondary text-sm">{used} / {seats} seats used</span>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
          <div className="h-full" style={{ width: `${Math.min(100, (used / seats) * 100)}%`, background: 'var(--accent)' }} />
        </div>
        {used >= seats && (
          <p className="text-sm mt-2" style={{ color: 'var(--accent)' }}>You've reached your seat limit — upgrade to add more clients.</p>
        )}
      </Card>

      {!configured && (
        <Card className="mb-5 max-w-lg" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Payments aren't enabled on this server yet. Add Razorpay keys to turn on checkout — plans and seat limits still apply.
          </p>
        </Card>
      )}

      {msg && <Card className="mb-5 max-w-lg"><p className="text-sm" style={{ color: 'var(--text)' }}>{msg}</p></Card>}

      <div className="grid gap-3 sm:grid-cols-3 max-w-3xl">
        {plans.map((p) => (
          <Card key={p.id} className={plan === p.id ? '' : 'hover:border-[var(--accent-border)] transition-colors'}>
            <p className="font-bold text-lg capitalize" style={{ color: 'var(--text)' }}>{p.name}</p>
            <p className="uc-secondary text-sm">{p.seats} seat{p.seats > 1 ? 's' : ''}</p>
            <p className="mt-2 mb-3 text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {p.amount === 0 ? 'Free' : `₹${(p.amount / 100).toLocaleString('en-IN')}`}
              {p.amount > 0 && <span className="uc-muted text-sm font-normal"> /mo</span>}
            </p>
            {plan === p.id ? (
              <span className="uc-badge uc-badge--good">Current</span>
            ) : p.amount === 0 ? (
              <span className="uc-muted text-sm">Default</span>
            ) : (
              <Button variant="primary" className="uc-btn--sm" onClick={() => choose(p.id)} disabled={busy === p.id}>
                {busy === p.id ? <Spinner size={14} /> : 'Upgrade'}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  )
}
