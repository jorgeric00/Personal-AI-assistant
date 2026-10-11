import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ApiError } from '../../api/client'
import { noteKeys, saveNote, type Note, type NoteInput } from './api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 700

function isEmpty(input: NoteInput) {
  return !input.title.trim() && !input.body.trim()
}

/**
 * Guarda la nota automáticamente mientras se escribe. Los guardados van de uno en uno (nunca se crean dos notas
 * por escribir rápido) y lo pendiente se guarda también al cerrar, al salir de la pantalla o al pasar la app a
 * segundo plano. Una nota nueva no se crea hasta que tiene título o contenido.
 */
export function useAutosave(initial: Note | null, input: NoteInput, enabled: boolean) {
  const queryClient = useQueryClient()
  const [noteId, setNoteId] = useState(initial?.id ?? null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<ApiError | null>(null)

  const latest = useRef(input)
  const idRef = useRef(initial?.id ?? null)
  const saved = useRef(JSON.stringify(input))
  const runner = useRef({ running: false, again: false })

  useLayoutEffect(() => {
    latest.current = input
  })

  const saveOnce = useCallback(async () => {
    const current = latest.current
    const key = JSON.stringify(current)
    if (key === saved.current || (!idRef.current && isEmpty(current))) return true
    setStatus('saving')
    try {
      const note = await saveNote(idRef.current, current)
      idRef.current = note.id
      saved.current = key
      setNoteId(note.id)
      setError(null)
      setStatus(JSON.stringify(latest.current) === key ? 'saved' : 'saving')
      queryClient.setQueryData(noteKeys.detail(note.id), note)
      void queryClient.invalidateQueries({ queryKey: noteKeys.all, refetchType: 'active' })
      return true
    } catch (e) {
      setError(e instanceof ApiError ? e : null)
      setStatus('error')
      return false
    }
  }, [queryClient])

  const flush = useCallback(async () => {
    const state = runner.current
    if (state.running) {
      state.again = true
      return
    }
    state.running = true
    try {
      let ok = true
      do {
        state.again = false
        ok = await saveOnce()
      } while (ok && state.again)
    } finally {
      state.running = false
    }
  }, [saveOnce])

  const inputKey = JSON.stringify(input)
  useEffect(() => {
    if (!enabled || inputKey === saved.current) return
    const timer = window.setTimeout(() => void flush(), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [inputKey, enabled, flush])

  useEffect(() => {
    if (!enabled) return
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [enabled, flush])

  return { noteId, status, error, flush }
}
