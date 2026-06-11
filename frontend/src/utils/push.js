import api from '../api/axios'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function registerPush() {
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await saveSub(existing)
      return
    }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    await saveSub(sub)
  } catch (e) {
    console.warn('Push subscribe error:', e)
  }
}

async function saveSub(sub) {
  const j = sub.toJSON()
  await api.post('/auth/push/subscribe/', {
    endpoint: j.endpoint,
    p256dh:   j.keys.p256dh,
    auth:     j.keys.auth,
  })
}

export async function unregisterPush() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await api.delete('/auth/push/subscribe/', { data: { endpoint: sub.endpoint } })
      await sub.unsubscribe()
    }
  } catch (e) {
    console.warn('Push unsubscribe error:', e)
  }
}
