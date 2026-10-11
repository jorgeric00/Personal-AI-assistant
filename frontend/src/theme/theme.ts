import { useCallback, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'lifeos.theme'

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') delete root.dataset.theme
  else root.dataset.theme = preference
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Sin almacenamiento local: la preferencia dura solo esta sesión.
  }
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference)
  const update = useCallback((next: ThemePreference) => {
    applyThemePreference(next)
    setPreference(next)
  }, [])
  return [preference, update] as const
}
