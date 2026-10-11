import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'

/**
 * Estado de las notificaciones push en este dispositivo:
 * - unsupported: el navegador no tiene Push API.
 * - ios-install: iPhone/iPad sin la app instalada (Safari solo permite push en la app de la pantalla de inicio).
 * - insecure: la página no se sirve por HTTPS.
 * - denied: el usuario bloqueó el permiso.
 * - off / on: se puede activar / ya está activa.
 */
export type PushStatus = 'loading' | 'unsupported' | 'ios-install' | 'insecure' | 'denied' | 'off' | 'on'

const pushKey = ['push', 'state'] as const

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function supportsPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

async function readStatus(): Promise<PushStatus> {
  if (!window.isSecureContext) return 'insecure'
  if (!supportsPush()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function usePushState() {
  const query = useQuery({ queryKey: pushKey, queryFn: readStatus, staleTime: 30_000 })
  return { status: (query.data ?? 'loading') as PushStatus, refresh: query.refetch }
}

export function useEnablePush() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const { publicKey } = await apiFetch<{ publicKey: string }>('/api/push/public-key')
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey),
        }))
      const json = subscription.toJSON()
      await apiFetch<void>('/api/push/subscriptions', {
        method: 'POST',
        body: { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: pushKey }),
  })
}

export function useDisablePush() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const subscription = await currentSubscription()
      if (!subscription) return
      await apiFetch<void>('/api/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } })
      await subscription.unsubscribe()
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: pushKey }),
  })
}

export function useTestPush() {
  return useMutation({
    mutationFn: () => apiFetch<{ delivered: number }>('/api/push/test', { method: 'POST' }),
  })
}
