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

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
