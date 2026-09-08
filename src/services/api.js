import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// Wake the backend early (best-effort; failures ignored).
export function warmApi() {
  api.get('/health', { timeout: 25000 }).catch(() => {})
}

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('unclinq_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, try one silent refresh; if that fails, clear the session and go to /login.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true
      try {
        const refreshRes = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${localStorage.getItem('unclinq_token')}` } }
        )
        const newToken = refreshRes.data.token
        localStorage.setItem('unclinq_token', newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (_refreshErr) {
        localStorage.removeItem('unclinq_token')
        localStorage.removeItem('unclinq_user')
        window.location.hash = '#/login'
      }
    }
    return Promise.reject(err)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────────
export const authAPI = {
  sendOtp: (email, purpose = 'login') => api.post('/auth/send-otp', { email, purpose }),
  verifyOtp: (email, code, purpose = 'login', name, role) =>
    api.post('/auth/verify-otp', { email, code, purpose, name, role }),
  login: ({ email, password }) => api.post('/auth/login', { email, password }),
  googleAuth: (access_token, role) => api.post('/auth/google', { access_token, role }),
  me: () => api.get('/auth/me'),
  updateSettings: (data) => api.patch('/auth/settings', data),
  refresh: () => api.post('/auth/refresh'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
  deleteAccount: (confirm = 'DELETE') => api.delete('/auth/account', { data: { confirm } }),
  completeOnboarding: (intention) => api.post('/auth/onboarding/complete', intention ? { intention } : {}),
  exportData: () => api.get('/auth/account/export', { responseType: 'blob' }),
}

// ─── Invitations (code-first onboarding) ────────────────────────────────────
// validate is public (client has no account yet); redeem/create/list need auth.
export const invitationsAPI = {
  validate: (code) => api.get(`/invitations/validate/${encodeURIComponent(code)}`),
  redeem: (code) => api.post('/invitations/redeem', { code }),
  create: (data) => api.post('/invitations', data),
  list: () => api.get('/invitations'),
  revoke: (id) => api.post(`/invitations/${id}/revoke`),
}

// ─── Emora (client) ────────────────────────────────────────────────────────
export const emoraAPI = {
  sendMessage: (message) => api.post('/emora/message', { message }),
  getSession: () => api.get('/emora/session'),
  endSession: (payload = {}) => api.post('/emora/end', payload),
}

// ─── Links (therapist ↔ client) ────────────────────────────────────────────
export const linksAPI = {
  create: (client_email) => api.post('/links', { client_email }),
  me: () => api.get('/links/me'),
  consent: (id, consent_scope) => api.post(`/links/${id}/consent`, consent_scope ? { consent_scope } : {}),
  revoke: (id) => api.post(`/links/${id}/revoke`),
}

// ─── Sessions (recordings) ──────────────────────────────────────────────────
export const sessionsAPI = {
  // Pass FormData; do NOT set Content-Type — axios sets the multipart boundary.
  // `config` allows a longer timeout for big audio uploads on slow mobile links.
  upload: (formData, config) => api.post('/sessions', formData, config),
  list: (clientId) => api.get('/sessions', { params: clientId ? { client_id: clientId } : {} }),
  get: (id) => api.get(`/sessions/${id}`),
  swapSpeakers: (id) => api.post(`/sessions/${id}/swap-speakers`),
  reprocess: (id) => api.post(`/sessions/${id}/reprocess`),
  approveSummary: (id) => api.post(`/sessions/${id}/approve-summary`),
  correctSpeaker: (id, seq, speaker) => api.patch(`/sessions/${id}/segments/${seq}`, { speaker }),
  editSummary: (id, session_summary) => api.patch(`/sessions/${id}/summary`, { session_summary }),
  editMemory: (id, memId, data) => api.patch(`/sessions/${id}/memory/${memId}`, data),
  export: (id) => api.get(`/sessions/${id}/export`, { responseType: 'blob' }),
}

// ─── Therapist ───────────────────────────────────────────────────────────────
export const therapistAPI = {
  stats: () => api.get('/therapist/stats'),
  clients: () => api.get('/therapist/clients'),
  overview: (clientId) => api.get(`/therapist/clients/${clientId}/overview`),
  journey: (clientId) => api.get(`/therapist/clients/${clientId}/journey`),
  reflection: (clientId) => api.get(`/therapist/clients/${clientId}/reflection`),
  setNextSession: (clientId, next_session_at) => api.patch(`/therapist/clients/${clientId}/next-session`, { next_session_at }),
  briefing: (clientId) => api.get(`/therapist/clients/${clientId}/briefing`),
  generateBriefing: (clientId) => api.post(`/therapist/clients/${clientId}/briefing`),
  signals: () => api.get('/therapist/signals'),
  ackSignal: (id) => api.post(`/therapist/signals/${id}/ack`),
  ackSignals: (ids) => api.post('/therapist/signals/ack', { ids }),
  assignExercise: (clientId, description) => api.post(`/therapist/clients/${clientId}/exercises`, { description }),
  addMemory: (clientId, content, kind) => api.post(`/therapist/clients/${clientId}/memory`, { content, kind }),
  notes: (clientId) => api.get(`/therapist/clients/${clientId}/notes`),
  addNote: (clientId, body, session_id) => api.post(`/therapist/clients/${clientId}/notes`, { body, session_id }),
  updateNote: (id, body) => api.patch(`/therapist/notes/${id}`, { body }),
  deleteNote: (id) => api.delete(`/therapist/notes/${id}`),
}

// ─── Billing (therapist) ────────────────────────────────────────────────────
export const billingAPI = {
  plans: () => api.get('/billing/plans'),
  subscription: () => api.get('/billing/subscription'),
  createOrder: (plan) => api.post('/billing/order', { plan }),
}

// ─── Web push ────────────────────────────────────────────────────────────────
export const pushAPI = {
  vapidKey: () => api.get('/push/vapid-public-key'),
  subscribe: (subscription) => api.post('/push/subscribe', { subscription }),
  unsubscribe: (endpoint) => api.post('/push/unsubscribe', { endpoint }),
}

// ─── Client ──────────────────────────────────────────────────────────────────
export const clientAPI = {
  home: () => api.get('/client/home'),
  journey: () => api.get('/client/journey'),
  journeyModel: () => api.get('/client/journey-model'),
  context: () => api.get('/client/context'),
  events: () => api.get('/client/events'),
  addEvent: (data) => api.post('/client/events', data),
  // Voice note → text. Pass FormData with an 'audio' blob; do NOT set Content-Type.
  voiceNote: (formData, config) => api.post('/client/voice-note', formData, config),
  exercises: () => api.get('/client/exercises'),
  updateExercise: (id, data) => api.patch(`/client/exercises/${id}`, data),
  notifications: () => api.get('/client/notifications'),
  dismissNotification: (id) => api.post(`/client/notifications/${id}/dismiss`),
  getReflection: () => api.get('/client/reflection'),
  saveReflection: (data) => api.post('/client/reflection', data),
  checkIn: (data) => api.post('/client/events', data), // one-tap "how are things going?"
}

export default api
