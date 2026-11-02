import { describe, expect, it } from 'vitest'

import serverEn from '../../../backend/src/main/resources/messages_en.properties?raw'
import serverEs from '../../../backend/src/main/resources/messages.properties?raw'
import { LOCAL_ONLY_KEYS, MESSAGES } from './messages'

function properties(source: string): Record<string, string> {
  return Object.fromEntries(
    source
      .split('\n')
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  )
}

describe('mensajes de la API local', () => {
  it.each([
    ['es', serverEs],
    ['en', serverEn],
  ] as const)('coinciden con los del servidor (%s)', (language, source) => {
    const server = properties(source)
    for (const [key, value] of Object.entries(MESSAGES[language])) {
      if (!LOCAL_ONLY_KEYS.includes(key)) expect([key, value]).toEqual([key, server[key]])
    }
    expect(Object.keys(MESSAGES[language]).sort()).toEqual(Object.keys(MESSAGES.es).sort())
  })
})
