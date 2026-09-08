import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import './index.css'
import { registerServiceWorker } from './lib/pwa'

registerServiceWorker()

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder'
if (GOOGLE_CLIENT_ID === 'placeholder') {
  console.warn(
    '[Unclinq] VITE_GOOGLE_CLIENT_ID is not set — "Continue with Google" will not work until it is set and the frontend is rebuilt.'
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
)
