import { Validator } from '../errors'
import { route, type LocalContext } from '../router'
import { asBody, text } from '../values'

/** Sin servidor no hay cuenta ni inicio de sesión: la persona de la app y sus preferencias viven en app_setting. */

const LOCALES = ['es', 'en']

export function setting(ctx: LocalContext, key: string): string | null {
  return ctx.db.get<{ value: string }>('select value from app_setting where key = ?', [key])?.value ?? null
}

function setSetting(ctx: LocalContext, key: string, value: string) {
  ctx.db.run('insert into app_setting (key, value) values (?, ?) on conflict (key) do update set value = excluded.value', [
    key,
    value,
  ])
}

function deviceLocale(): string {
  const language = typeof navigator === 'undefined' ? 'es' : navigator.language.slice(0, 2)
  return LOCALES.includes(language) ? language : 'es'
}

function me(ctx: LocalContext) {
  return {
    id: 'local',
    email: '',
    displayName: setting(ctx, 'displayName') ?? '',
    locale: setting(ctx, 'locale') ?? deviceLocale(),
    timezone: ctx.timeZone,
  }
}

export const accountRoutes = [
  route('GET', '/api/auth/me', ({ ctx }) => me(ctx)),
  route('PATCH', '/api/me/preferences', ({ ctx, body }) => {
    const input = asBody(body)
    const locale = text(input, 'locale')
    const displayName = text(input, 'displayName')
    new Validator()
      .add(locale !== null && !LOCALES.includes(locale), 'locale', 'user.locale.invalid')
      .throwIfAny()
    if (locale !== null) setSetting(ctx, 'locale', locale)
    if (displayName !== null) setSetting(ctx, 'displayName', displayName.trim().slice(0, 100))
    return me(ctx)
  }),
]
