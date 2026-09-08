/**
 * PWA install helpers. Captures the Android/Chrome `beforeinstallprompt` event
 * so we can show an "Add to Home Screen" button at the right moment (right after
 * a client validates their invitation code). iOS Safari has no such event, so we
 * detect it and show the manual Share → Add to Home Screen hint instead.
 */
let deferredPrompt = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    listeners.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((fn) => fn())
  })
}

export function isStandalone() {
  return (
    (typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true)) || false
  )
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// True when we can show a one-tap install button (Chrome/Android captured the event).
export function canPromptInstall() {
  return !!deferredPrompt
}

// Subscribe to install-availability changes; returns an unsubscribe fn.
export function onInstallAvailabilityChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Fire the native install prompt. Resolves 'accepted' | 'dismissed' | 'unavailable'.
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable'
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  listeners.forEach((fn) => fn())
  return outcome
}

// Register the service worker (required for installability). Safe no-op if unsupported.
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ })
  })
}
