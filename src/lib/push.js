/*
 * Web-push helpers — subscribe/unsubscribe the browser to push, syncing with the
 * backend. No-ops gracefully where push isn't supported or configured.
 */
import { pushAPI } from '../services/api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function isSubscribed() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Notifications are not supported on this device.')
  const { data } = await pushAPI.vapidKey()
  if (!data.enabled || !data.key) throw new Error('Notifications are not available yet.')

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notification permission was not granted.')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.key),
  })
  await pushAPI.subscribe(sub.toJSON())
  return true
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  if (sub) {
    await pushAPI.unsubscribe(sub.endpoint).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  return true
}
