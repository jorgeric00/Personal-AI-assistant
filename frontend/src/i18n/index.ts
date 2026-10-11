import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en'
import es from './locales/es'

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'es'

/** Nombre de cada idioma escrito en ese mismo idioma, para el selector. */
export const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' }

/** Etiqueta BCP 47 para formatear fechas y números. */
const INTL_LOCALES: Record<Language, string> = { es: 'es-ES', en: 'en-GB' }

const STORAGE_KEY = 'lifeos.language'

export const resources = { es: { translation: es }, en: { translation: en } } as const

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLanguage(value) ? value : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export function intlLocale(language: Language = currentLanguage()): string {
  return INTL_LOCALES[language]
}

/** Cambia el idioma de la interfaz y lo recuerda en este dispositivo (también para la pantalla de login). */
export async function setLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Sin almacenamiento local: el idioma dura solo esta sesión.
  }
  if (i18n.language !== language) await i18n.changeLanguage(language)
}

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
