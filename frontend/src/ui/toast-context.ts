import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export type ShowToast = (text: string, options?: { action?: ToastAction; tone?: 'default' | 'error' }) => void

export const ToastContext = createContext<ShowToast>(() => {})

export function useToast() {
  return useContext(ToastContext)
}
