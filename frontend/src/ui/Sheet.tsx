import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { CloseIcon } from './icons'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Botones extra junto al de cerrar. */
  headerActions?: ReactNode
  /** Ocupa casi toda la pantalla en el móvil (editores de texto largo). */
  tall?: boolean
}

/**
 * Panel modal: hoja inferior en el móvil y diálogo centrado en escritorio.
 * Cierra con Escape o tocando fuera, devuelve el foco al elemento que lo abrió.
 */
export function Sheet({ title, onClose, children, footer, headerActions, tall = false }: SheetProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button')
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key === 'Tab' && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        )
        if (focusable.length === 0) return
        const firstEl = focusable[0]
        const lastEl = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault()
          lastEl.focus()
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
      previouslyFocused?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={tall ? 'sheet sheet-tall' : 'sheet'} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <header className="sheet-header">
          <h2 id={titleId} className="h2">
            {title}
          </h2>
          <div className="sheet-header-actions">
            {headerActions}
            <button type="button" className="icon-button" onClick={onClose} aria-label={t('common.close')}>
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
