import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  // Light/dark appearance — orthogonal to the role theme (client/therapist).
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem('unclinq_mode') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const setMode = useCallback((next) => {
    setModeState(next)
    try { localStorage.setItem('unclinq_mode', next) } catch { /* ignore */ }
  }, [])
  const toggleMode = useCallback(() => {
    setModeState((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('unclinq_mode', next) } catch { /* ignore */ }
      return next
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('unclinq_token')
    localStorage.removeItem('unclinq_user')
    setUser(null)
    setProfile(null)
  }, [])

  // Rehydrate from localStorage, then refresh from the server.
  useEffect(() => {
    const token = localStorage.getItem('unclinq_token')
    const cachedUser = localStorage.getItem('unclinq_user')

    if (token && cachedUser) {
      let cached = null
      try { cached = JSON.parse(cachedUser) } catch { cached = null }
      if (cached) {
        setUser(cached)
        setProfile(cached)
      }

      const meRequest = Promise.race([
        authAPI.me(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ])
      meRequest
        .then((res) => {
          const serverUser = res.data.user
          setUser(serverUser)
          setProfile(serverUser)
          localStorage.setItem('unclinq_user', JSON.stringify(serverUser))
        })
        .catch(() => {
          if (!cached) logout()
        })
        .finally(() => {
          setLoading(false)
          setAuthChecked(true)
        })
    } else {
      setLoading(false)
      setAuthChecked(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout])

  const login = useCallback((token, userData) => {
    localStorage.setItem('unclinq_token', token)
    localStorage.setItem('unclinq_user', JSON.stringify(userData))
    setUser(userData)
    setProfile(userData)
  }, [])

  const updateProfile = useCallback((updates) => {
    setProfile((prev) => ({ ...prev, ...updates }))
    setUser((prev) => ({ ...prev, ...updates }))
    let cached = {}
    try { cached = JSON.parse(localStorage.getItem('unclinq_user') || '{}') } catch { cached = {} }
    localStorage.setItem('unclinq_user', JSON.stringify({ ...cached, ...updates }))
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const res = await authAPI.me()
      const serverUser = res.data.user
      setUser(serverUser)
      setProfile(serverUser)
      localStorage.setItem('unclinq_user', JSON.stringify(serverUser))
    } catch {
      /* ignore */
    }
  }, [])

  const role = profile?.role || user?.role || null

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        authChecked,
        isAuthenticated: !!user,
        isTherapist: role === 'therapist',
        isClient: role === 'client',
        mode,
        setMode,
        toggleMode,
        login,
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
