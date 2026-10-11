import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ToastContext, type ShowToast, type ToastAction } from './toast-context'

interface ToastMessage {
  id: number
  text: string
  action?: ToastAction
  tone?: 'default' | 'error'
}

const DURATION_MS = 5000

/** Avisos breves tras guardar, completar o eliminar, con acción opcional («Deshacer»). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const counter = useRef(0)

  const show = useCallback<ShowToast>((text, options) => {
    counter.current += 1
    setToast({ id: counter.current, text, ...options })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), DURATION_MS)
    return () => window.clearTimeout(id)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className={`toast${toast.tone === 'error' ? ' toast-error' : ''}`} key={toast.id}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.onClick()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
