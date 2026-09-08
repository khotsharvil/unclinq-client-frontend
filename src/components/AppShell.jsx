import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, NotebookPen, MessageCircle, Wind, LineChart, Sprout, Settings as SettingsIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { clientAPI, therapistAPI } from '../services/api'

// The client app is the five things a client actually does in the loop.
// Journey / Memory / Sharing / Record stay reachable (Home quick-links + Settings)
// but are off the primary bar so the app doesn't expose its internal architecture.
const CLIENT_NAV = [
  { to: '/home', label: 'Home' },
  { to: '/emora', label: 'Emora' },
  { to: '/journal', label: 'Capture' },
  { to: '/exercises', label: 'Actions' },
  { to: '/prepare', label: 'Prepare' },
  { to: '/settings', label: 'Settings' },
]

// Client bottom-nav (B2C design language). Emora is the raised center FAB —
// the daily "talk it through" action; Rescue is the in-the-moment safety net.
const CLIENT_BOTTOM_NAV = [
  { to: '/home', label: 'Home', Icon: Home },
  { to: '/journal', label: 'Journal', Icon: NotebookPen },
  { to: '/emora', label: 'Emora', Icon: MessageCircle, hero: true },
  { to: '/exercises', label: 'Practice', Icon: Sprout },
  { to: '/journey', label: 'Journey', Icon: LineChart },
]

function ClientBottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-lg" style={{ transform: 'translateX(-50%)' }}>
      <div style={{ background: 'var(--nav-bg)', borderTop: '1px solid var(--hairline)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-end justify-around px-2 pt-2 pb-1.5">
          {CLIENT_BOTTOM_NAV.map(({ to, label, Icon, hero }) => (
            <NavLink key={to} to={to} aria-label={label} className="flex-1 flex flex-col items-center gap-1">
              {({ isActive }) => hero ? (
                <>
                  <span className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95"
                    style={{ marginTop: '-14px', background: 'var(--sp)', color: '#fff',
                      boxShadow: `0 6px 16px var(--sp-glow, rgba(192,91,58,0.35))`,
                      outline: isActive ? '2px solid var(--sp)' : '2px solid transparent', outlineOffset: '2.5px' }}>
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--sp)' : 'var(--text-muted)' }}>{label}</span>
                </>
              ) : (
                <>
                  <span className="flex items-center justify-center transition-all"
                    style={{ width: 40, height: 32, borderRadius: 16, background: isActive ? 'rgba(var(--sp-rgb),0.10)' : 'transparent', color: isActive ? 'var(--sp)' : 'var(--text-muted)' }}>
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--sp)' : 'var(--text-muted)' }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

// The therapist works client-by-client; signals are attention cues on Home,
// not a destination, and billing lives under Settings.
const THERAPIST_NAV = [
  { to: '/t', label: 'Home', end: true },
  { to: '/t/settings', label: 'Settings' },
]

/*
 * AppShell — role-aware layout wrapper.
 * theme="client"    -> warm, mobile-first, max-width narrow.
 * theme="therapist" -> cooler, wider desktop layout.
 */
export default function AppShell({ theme = 'client', children }) {
  const { profile, logout, mode } = useApp()
  const navigate = useNavigate()
  const nav = theme === 'therapist' ? THERAPIST_NAV : CLIENT_NAV
  const isTherapist = theme === 'therapist'

  // Nav badges: unread notifications (client) / open signals (therapist).
  const [badges, setBadges] = useState({})
  useEffect(() => {
    let alive = true
    if (isTherapist) {
      therapistAPI.stats()
        .then((r) => alive && setBadges({ '/t': r.data?.stats?.open_signals || 0 }))
        .catch(() => {})
    } else {
      clientAPI.notifications()
        .then((r) => alive && setBadges({ '/home': (r.data?.notifications || []).length }))
        .catch(() => {})
    }
    return () => { alive = false }
  }, [isTherapist])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div data-theme={theme} data-mode={mode} className="min-h-dvh uc-bg" style={{ color: 'var(--text)' }}>
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className={`mx-auto flex items-center gap-4 px-4 py-3 ${
            isTherapist ? 'max-w-6xl' : 'max-w-lg'
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="Unclinq" className="w-7 h-7 object-contain" />
            <span className="font-bold tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              Unclinq
              {isTherapist && (
                <span className="uc-muted font-semibold text-xs ml-1.5">for therapists</span>
              )}
            </span>
          </div>

          {isTherapist && (
            <nav className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
              {nav.map((item) => {
                const count = badges[item.to] || 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `uc-navlink ${isActive ? 'uc-navlink--active' : ''}`
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {item.label}
                      {count > 0 && (
                        <span
                          className="inline-flex items-center justify-center text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </span>
                  </NavLink>
                )
              })}
            </nav>
          )}

          {isTherapist ? (
            <div className="shrink-0 hidden sm:flex items-center gap-3">
              {profile?.name && (
                <span className="uc-muted text-xs truncate max-w-[120px]">{profile.name}</span>
              )}
              <button className="uc-btn uc-btn--ghost uc-btn--sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex-1 flex justify-end items-center gap-1">
              <NavLink to="/rescue" aria-label="Rescue — a calm reset"
                className={() => 'w-9 h-9 rounded-full flex items-center justify-center transition-colors'}
                style={({ isActive }) => ({ color: isActive ? '#5C7F79' : 'var(--text-muted)', background: isActive ? 'rgba(92,127,121,0.12)' : 'transparent' })}>
                <Wind size={19} strokeWidth={1.8} />
              </NavLink>
              <NavLink to="/settings" aria-label="Settings"
                className={() => 'w-9 h-9 rounded-full flex items-center justify-center transition-colors'}
                style={({ isActive }) => ({ color: isActive ? 'var(--sp)' : 'var(--text-muted)', background: isActive ? 'rgba(var(--sp-rgb),0.10)' : 'transparent' })}>
                <SettingsIcon size={19} strokeWidth={1.8} />
              </NavLink>
            </div>
          )}
        </div>
      </header>

      <main
        className={`mx-auto px-4 py-5 ${isTherapist ? 'max-w-6xl' : 'max-w-lg pb-nav'}`}
        style={isTherapist ? { paddingBottom: '3rem' } : undefined}
      >
        {children}
      </main>

      {!isTherapist && <ClientBottomNav />}
    </div>
  )
}
