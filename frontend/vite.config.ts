/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const backend = process.env.LIFEOS_BACKEND_URL ?? 'http://localhost:8080'

const shortcutIcon = { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'LifeOS',
        short_name: 'LifeOS',
        description: 'Tu centro de gestión personal',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f5',
        theme_color: '#0f766e',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Atajos al mantener pulsado el icono (Android y escritorio); abren directamente el formulario.
        shortcuts: [
          { name: 'Nueva tarea', short_name: 'Tarea', url: '/tareas?nueva=TASK', icons: [shortcutIcon] },
          { name: 'Nuevo gasto', short_name: 'Gasto', url: '/finanzas?nuevo=EXPENSE', icons: [shortcutIcon] },
          { name: 'Nueva actividad', short_name: 'Actividad', url: '/agenda?actividad=nueva', icons: [shortcutIcon] },
          { name: 'Hábitos de hoy', short_name: 'Hábitos', url: '/habitos', icons: [shortcutIcon] },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': backend,
      '/actuator': backend,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
