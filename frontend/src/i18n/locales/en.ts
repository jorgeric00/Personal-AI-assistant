import type { Messages } from './es'

const en: Messages = {
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    skipToContent: 'Skip to content',
  },
  errors: {
    title: 'Error',
    offlineTitle: 'Offline',
    offline: 'Cannot reach the server. Check your internet connection.',
    unauthorized: 'Your session has expired. Please sign in again.',
    forbidden: 'You are not allowed to do this. Reload the page and try again.',
    server: 'The server is not available right now. Please try again in a few minutes.',
    generic: 'The operation could not be completed.',
    connectionTitle: 'Could not connect',
    connection: 'The server is not responding. Check your connection and try again.',
  },
  nav: {
    main: 'Main navigation',
    today: 'Today',
    settings: 'Settings',
  },
  login: {
    subtitle: 'Sign in to see your day.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
  },
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    withName: '{{greeting}}, {{name}}',
  },
  dashboard: {
    emptyTitle: 'Your day will show up here',
    emptyBody:
      'This is your summary for today. Once tasks, reminders, notes and finances are available, you will see what is pending here and add things with a single tap.',
  },
  settings: {
    title: 'Settings',
    account: 'Account',
    name: 'Name',
    email: 'Email',
    timezone: 'Time zone',
    language: 'Language',
    languageError: 'The language could not be saved.',
    appearance: 'Appearance',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    install: 'Install on your phone',
    installed: 'LifeOS is already installed on this device.',
    installPrompt: 'Add LifeOS to your home screen to open it like an app.',
    installButton: 'Install LifeOS',
    installIos:
      'In Safari, tap the Share button and choose “Add to Home Screen”. This lets you receive notifications once they are available.',
    installManual: 'Open the browser menu and choose “Install app” or “Add to Home Screen”.',
    logout: 'Sign out',
    loggingOut: 'Signing out…',
  },
}

export default en
