import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { registerSW } from 'virtual:pwa-register'

import { createQueryClient } from './app/queryClient'
import './i18n'
import { routes } from './app/router'
import { ToastProvider } from './ui/Toast'
import './index.css'
import { LOCAL_MODE } from './platform'

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)

// En la app Android los ficheros ya están en el móvil: no hace falta service worker.
if (!LOCAL_MODE) registerSW({ immediate: true })
// En la app los avisos los programa el propio móvil.
if (import.meta.env.VITE_LOCAL === 'true') {
  void import('./local').then((local) => local.startReminders((url) => void router.navigate(url)))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
