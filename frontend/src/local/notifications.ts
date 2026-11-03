import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import type { ScheduledReminder } from './modules/reminders'

/**
 * Avisos de la app Android: el propio móvil los programa con notificaciones locales, sin servidor. En el navegador
 * (la vista previa de la app) no hay notificaciones locales, así que no se programa nada.
 */

export type ReminderPermission = 'unsupported' | 'granted' | 'denied' | 'prompt'

export interface ReminderStatus {
  permission: ReminderPermission
  /** Android 12+: sin el permiso de alarmas exactas los avisos pueden llegar con unos minutos de retraso. */
  exact: boolean
}

export function remindersSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export async function reminderStatus(): Promise<ReminderStatus> {
  if (!remindersSupported()) return { permission: 'unsupported', exact: false }
  const { display } = await LocalNotifications.checkPermissions()
  const permission = display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
  const exact = Capacitor.getPlatform() !== 'android' || (await exactAllowed())
  return { permission, exact }
}

async function exactAllowed(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return true
  }
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported()) return 'unsupported'
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

/** Abre el ajuste de Android «Alarmas y recordatorios» para que los avisos lleguen a su hora exacta. */
export async function openExactAlarmSetting(): Promise<void> {
  if (remindersSupported()) await LocalNotifications.changeExactNotificationSetting()
}

/**
 * Sustituye los avisos programados por los indicados. Si todavía no se ha pedido permiso y hay algo que avisar, lo
 * pide (Android muestra su diálogo una vez).
 */
export async function syncReminders(reminders: ScheduledReminder[]): Promise<void> {
  if (!remindersSupported()) return
  let { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted' && display !== 'denied' && reminders.length > 0) {
    display = (await LocalNotifications.requestPermissions()).display
  }
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
  if (display !== 'granted' || reminders.length === 0) return
  await LocalNotifications.schedule({
    notifications: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { at: r.at, allowWhileIdle: true },
      extra: { url: r.url },
    })),
  })
}

/** Al tocar un aviso, la app se abre en la pantalla correspondiente. */
export function onReminderOpened(open: (url: string) => void): void {
  if (!remindersSupported()) return
  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const url = (event.notification.extra as { url?: unknown } | undefined)?.url
    open(typeof url === 'string' ? url : '/')
  })
}
