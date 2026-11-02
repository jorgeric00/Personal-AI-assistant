import type { ParseKeys } from 'i18next'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'

import { useCurrentUser, useLogout, useUpdateDisplayName, useUpdateLanguage } from '../../auth/auth'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isLanguage } from '../../i18n'
import { LOCAL_MODE } from '../../platform'
import { useThemePreference, type ThemePreference } from '../../theme/theme'
import { Field } from '../../ui/Field'
import { useToast } from '../../ui/toast-context'
import { NotificationSettings } from '../notifications/NotificationSettings'
import { DeleteDataSheet } from './DeleteDataSheet'
import { useInstallPrompt } from './useInstallPrompt'

const THEME_OPTIONS: { value: ThemePreference; label: ParseKeys }[] = [
  { value: 'system', label: 'settings.themeSystem' },
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' },
]

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { data: user } = useCurrentUser()
  const updateLanguage = useUpdateLanguage()
  const [theme, setTheme] = useThemePreference()
  const language = isLanguage(i18n.language) ? i18n.language : undefined
  const [params, setParams] = useSearchParams()
  const setDeleting = (open: boolean) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (open) next.set('borrar', '1')
        else next.delete('borrar')
        return next
      },
      { replace: true },
    )

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <h1 className="h1">{t('settings.title')}</h1>
      </header>

      {LOCAL_MODE ? (
        <LocalProfile />
      ) : (
        <section className="card stack" aria-labelledby="account-title">
          <h2 id="account-title" className="h2">
            {t('settings.account')}
          </h2>
          <dl className="details">
            <div>
              <dt>{t('settings.name')}</dt>
              <dd>{user?.displayName}</dd>
            </div>
            <div>
              <dt>{t('settings.email')}</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>{t('settings.timezone')}</dt>
              <dd>{user?.timezone}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="card stack" aria-labelledby="language-title">
        <h2 id="language-title" className="h2">
          {t('settings.language')}
        </h2>
        <div className="segmented segmented-2" role="radiogroup" aria-labelledby="language-title">
          {SUPPORTED_LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              lang={option}
              aria-checked={language === option}
              className="segmented-option"
              disabled={updateLanguage.isPending}
              onClick={() => updateLanguage.mutate(option)}
            >
              {LANGUAGE_NAMES[option]}
            </button>
          ))}
        </div>
        {updateLanguage.isError && (
          <p className="field-error" role="alert">
            {t('settings.languageError')}
          </p>
        )}
      </section>

      <section className="card stack" aria-labelledby="theme-title">
        <h2 id="theme-title" className="h2">
          {t('settings.appearance')}
        </h2>
        <div className="segmented" role="radiogroup" aria-labelledby="theme-title">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className="segmented-option"
              onClick={() => setTheme(option.value)}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </section>

      {!LOCAL_MODE && <NotificationSettings />}

      {!LOCAL_MODE && <ServerOnlySettings onDelete={() => setDeleting(true)} />}
      {!LOCAL_MODE && params.get('borrar') === '1' && <DeleteDataSheet onClose={() => setDeleting(false)} />}
    </div>
  )
}

/** Instalación, descarga y borrado de datos y cierre de sesión: solo tienen sentido con servidor. */
function ServerOnlySettings({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation()
  const logout = useLogout()
  const navigate = useNavigate()
  const install = useInstallPrompt()
  return (
    <>
      <section className="card stack" aria-labelledby="install-title">
        <h2 id="install-title" className="h2">
          {t('settings.install')}
        </h2>
        {install.kind === 'installed' && <p className="muted">{t('settings.installed')}</p>}
        {install.kind === 'prompt' && (
          <>
            <p className="muted">{t('settings.installPrompt')}</p>
            <button type="button" className="button button-primary" onClick={() => install.install()}>
              {t('settings.installButton')}
            </button>
          </>
        )}
        {install.kind === 'ios' && <p className="muted">{t('settings.installIos')}</p>}
        {install.kind === 'manual' && <p className="muted">{t('settings.installManual')}</p>}
      </section>

      <section className="card stack" aria-labelledby="data-title">
        <h2 id="data-title" className="h2">
          {t('settings.data')}
        </h2>
        <p className="muted">{t('settings.dataHelp')}</p>
        {/* Enlace normal: el navegador descarga el ZIP con la sesión, sin pasar por la memoria de la app */}
        <a className="button button-secondary" href="/api/export" download>
          {t('settings.dataDownload')}
        </a>
        <p className="muted small">{t('settings.dataSensitive')}</p>
        <button type="button" className="button button-danger-outline" onClick={onDelete}>
          {t('settings.deleteOpen')}
        </button>
      </section>

      <button
        type="button"
        className="button button-danger-outline"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
      >
        {logout.isPending ? t('settings.loggingOut') : t('settings.logout')}
      </button>
    </>
  )
}

/** En la app no hay cuenta: el nombre del saludo se guarda en el móvil, igual que el resto de datos. */
function LocalProfile() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: user } = useCurrentUser()
  const updateName = useUpdateDisplayName()
  const [name, setName] = useState<string | null>(null)
  const value = name ?? user?.displayName ?? ''

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    updateName.mutate(value, { onSuccess: () => toast(t('common.saved')) })
  }

  return (
    <section className="card stack" aria-labelledby="profile-title">
      <h2 id="profile-title" className="h2">
        {t('settings.profile')}
      </h2>
      <form className="stack-sm" onSubmit={onSubmit}>
        <Field label={t('settings.name')} id="profile-name">
          <input
            id="profile-name"
            maxLength={100}
            autoComplete="given-name"
            value={value}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <button type="submit" className="button button-secondary" disabled={updateName.isPending}>
          {t('common.save')}
        </button>
      </form>
      <p className="muted small">{t('settings.localData')}</p>
    </section>
  )
}
