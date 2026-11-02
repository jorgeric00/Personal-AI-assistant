import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ReminderStatus } from '../../local/notifications'
import { LOCAL_MODE } from '../../platform'

/** Estado de los avisos del móvil en la app Android (permiso de notificaciones y alarmas exactas). */

const statusKey = ['local-reminders', 'status'] as const

// La comparación literal permite que la versión web no incluya el código de la app.
const loadNative = () =>
  import.meta.env.VITE_LOCAL === 'true' ? import('../../local/notifications') : Promise.reject(new Error('web'))

export function useReminderStatus() {
  return useQuery({
    queryKey: statusKey,
    queryFn: async (): Promise<ReminderStatus> => (await loadNative()).reminderStatus(),
    enabled: LOCAL_MODE,
    staleTime: 10_000,
    // Al volver de los ajustes de Android el permiso puede haber cambiado.
    refetchOnWindowFocus: 'always',
  })
}

export function useRequestReminderPermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await (await loadNative()).requestReminderPermission()
      // Con el permiso recién concedido, programa los avisos que ya existían.
      if (import.meta.env.VITE_LOCAL === 'true') (await import('../../local')).scheduleReminderSync(0)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKey }),
  })
}

export function useOpenExactAlarmSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await loadNative()).openExactAlarmSetting(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: statusKey }),
  })
}
