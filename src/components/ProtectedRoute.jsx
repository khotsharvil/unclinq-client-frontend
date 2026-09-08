import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { PageLoader } from './ui'

/*
 * Guards a route. Redirects to /login when unauthenticated.
 * `role` optionally restricts the route; a mismatched role is sent to its own home.
 * Until first-run onboarding is complete, users are sent to /onboarding
 * (pass `skipOnboardingGate` on the onboarding route itself to avoid a loop).
 */
export default function ProtectedRoute({ children, role, skipOnboardingGate = false }) {
  const { isAuthenticated, authChecked, role: userRole, profile } = useApp()

  if (!authChecked) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Only redirect when we explicitly know onboarding isn't done (avoids a flash
  // before /me resolves, where the field may be undefined on the cached user).
  if (!skipOnboardingGate && profile?.onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />
  }

  if (role && userRole && userRole !== role) {
    return <Navigate to={userRole === 'therapist' ? '/t' : '/home'} replace />
  }

  return children
}
