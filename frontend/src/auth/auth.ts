import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '../api/client'
import { isLanguage, setLanguage, type Language } from '../i18n'

export interface CurrentUser {
  id: string
  email: string
  displayName: string
  locale: string
  timezone: string
}

export interface Credentials {
  email: string
  password: string
}

export const currentUserKey = ['auth', 'me'] as const

/** El idioma guardado en la cuenta manda sobre el del dispositivo. */
async function applyUserLanguage(user: CurrentUser) {
  if (isLanguage(user.locale)) await setLanguage(user.locale)
  return user
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await applyUserLanguage(await apiFetch<CurrentUser>('/api/auth/me'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserKey, queryFn: fetchCurrentUser, staleTime: 5 * 60_000 })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      applyUserLanguage(await apiFetch<CurrentUser>('/api/auth/login', { method: 'POST', body: credentials })),
    onSuccess: (user) => queryClient.setQueryData(currentUserKey, user),
  })
}

export function useUpdateLanguage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (locale: Language) => {
      const user = await apiFetch<CurrentUser>('/api/me/preferences', { method: 'PATCH', body: { locale } })
      return applyUserLanguage(user)
    },
    onSuccess: (user) => queryClient.setQueryData(currentUserKey, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(currentUserKey, null)
    },
  })
}
