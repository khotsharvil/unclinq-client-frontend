import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import ProtectedRoute from './components/ProtectedRoute'
import { PageLoader } from './components/ui'

// Public
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

// Client
const Home = lazy(() => import('./pages/client/Home'))
const Emora = lazy(() => import('./pages/client/Emora'))
const RecordSession = lazy(() => import('./pages/client/RecordSession'))
const Journal = lazy(() => import('./pages/client/Journal'))
const Prepare = lazy(() => import('./pages/client/Prepare'))
const Journey = lazy(() => import('./pages/client/Journey'))
const Context = lazy(() => import('./pages/client/Context'))
const Exercises = lazy(() => import('./pages/client/Exercises'))
const Rescue = lazy(() => import('./pages/client/Rescue'))
const Consent = lazy(() => import('./pages/client/Consent'))

// Shared
const Settings = lazy(() => import('./pages/Settings'))
const Onboarding = lazy(() => import('./pages/Onboarding'))

// Therapist
const ClientList = lazy(() => import('./pages/therapist/ClientList'))
const ClientDetail = lazy(() => import('./pages/therapist/ClientDetail'))
const SessionDetail = lazy(() => import('./pages/therapist/SessionDetail'))
const Upload = lazy(() => import('./pages/therapist/Upload'))
const Signals = lazy(() => import('./pages/therapist/Signals'))
const Billing = lazy(() => import('./pages/therapist/Billing'))

// Root: route by role when signed in, else to /login.
function RootRedirect() {
  const { isAuthenticated, authChecked, role, profile } = useApp()
  if (!authChecked) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (profile?.onboarding_completed === false) return <Navigate to="/onboarding" replace />
  return <Navigate to={role === 'therapist' ? '/t' : '/home'} replace />
}

function client(el) {
  return <ProtectedRoute role="client">{el}</ProtectedRoute>
}
function therapist(el) {
  return <ProtectedRoute role="therapist">{el}</ProtectedRoute>
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Client */}
            <Route path="/home" element={client(<Home />)} />
            <Route path="/emora" element={client(<Emora />)} />
            <Route path="/record" element={client(<RecordSession />)} />
            <Route path="/journal" element={client(<Journal />)} />
            <Route path="/prepare" element={client(<Prepare />)} />
            <Route path="/journey" element={client(<Journey />)} />
            <Route path="/context" element={client(<Context />)} />
            <Route path="/exercises" element={client(<Exercises />)} />
            <Route path="/rescue" element={client(<Rescue />)} />
            <Route path="/consent" element={client(<Consent />)} />

            {/* Onboarding. PUBLIC: the client invitation flow (code → account) runs
                before auth; the component guards returning/therapist users itself. */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Shared (settings adapts to role) */}
            <Route
              path="/settings"
              element={<ProtectedRoute><Settings /></ProtectedRoute>}
            />

            {/* Therapist */}
            <Route path="/t" element={therapist(<ClientList />)} />
            <Route path="/t/clients/:clientId" element={therapist(<ClientDetail />)} />
            <Route path="/t/sessions/:sessionId" element={therapist(<SessionDetail />)} />
            <Route path="/t/upload" element={therapist(<Upload />)} />
            <Route path="/t/signals" element={therapist(<Signals />)} />
            <Route path="/t/billing" element={therapist(<Billing />)} />
            <Route path="/t/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AppProvider>
  )
}
