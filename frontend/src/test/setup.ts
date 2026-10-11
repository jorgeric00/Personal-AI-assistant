import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import i18n from '../i18n'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.cookie.split('; ').forEach((c) => {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; Max-Age=0; path=/`
  })
  localStorage.clear()
  void i18n.changeLanguage('es')
})
