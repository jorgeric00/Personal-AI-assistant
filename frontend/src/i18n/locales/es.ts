/** Textos en español (idioma por defecto). Es la referencia: el resto de idiomas debe tener las mismas claves. */
const es = {
  common: {
    loading: 'Cargando…',
    retry: 'Reintentar',
    skipToContent: 'Saltar al contenido',
  },
  errors: {
    title: 'Error',
    offlineTitle: 'Sin conexión',
    offline: 'No hay conexión con el servidor. Comprueba tu conexión a internet.',
    unauthorized: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    forbidden: 'No tienes permiso para realizar esta acción. Recarga la página e inténtalo de nuevo.',
    server: 'El servidor no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.',
    generic: 'No se ha podido completar la operación.',
    connectionTitle: 'No se ha podido conectar',
    connection: 'El servidor no responde. Comprueba tu conexión e inténtalo de nuevo.',
  },
  nav: {
    main: 'Navegación principal',
    today: 'Hoy',
    settings: 'Ajustes',
  },
  login: {
    subtitle: 'Inicia sesión para ver tu día.',
    email: 'Correo electrónico',
    password: 'Contraseña',
    submit: 'Entrar',
    submitting: 'Entrando…',
  },
  greeting: {
    morning: 'Buenos días',
    afternoon: 'Buenas tardes',
    evening: 'Buenas noches',
    withName: '{{greeting}}, {{name}}',
  },
  dashboard: {
    emptyTitle: 'Tu día aparecerá aquí',
    emptyBody:
      'Este es el resumen de hoy. Cuando estén disponibles las tareas, los recordatorios, las notas y las finanzas, verás aquí lo que tienes pendiente y podrás añadir cosas con un toque.',
  },
  settings: {
    title: 'Ajustes',
    account: 'Cuenta',
    name: 'Nombre',
    email: 'Correo electrónico',
    timezone: 'Zona horaria',
    language: 'Idioma',
    languageError: 'No se ha podido guardar el idioma.',
    appearance: 'Apariencia',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    install: 'Instalar en el móvil',
    installed: 'LifeOS ya está instalada en este dispositivo.',
    installPrompt: 'Añade LifeOS a tu pantalla de inicio para abrirla como una app.',
    installButton: 'Instalar LifeOS',
    installIos:
      'En Safari, pulsa el botón Compartir y elige «Añadir a pantalla de inicio». Así podrás recibir notificaciones cuando estén disponibles.',
    installManual: 'Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».',
    logout: 'Cerrar sesión',
    loggingOut: 'Cerrando sesión…',
  },
}

export default es

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }
export type Messages = Widen<typeof es>
