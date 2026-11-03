import type { CapacitorConfig } from '@capacitor/cli'

// App Android: envuelve la misma interfaz web, compilada en modo «app» (datos en el móvil, sin servidor).
const config: CapacitorConfig = {
  appId: 'es.lifeos.app',
  appName: 'LifeOS',
  webDir: 'dist',
  android: {
    // Sin servidor no hay contenido remoto: la app solo carga sus propios ficheros.
    allowMixedContent: false,
  },
  plugins: {
    // La interfaz ya respeta env(safe-area-inset-*) (viewport-fit=cover), así que se dibuja de borde a borde.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
    // Avisos de tareas y recordatorios: icono de silueta y el color de LifeOS.
    LocalNotifications: { smallIcon: 'ic_stat_lifeos', iconColor: '#0F766E' },
  },
}

export default config
