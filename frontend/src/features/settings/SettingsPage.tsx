import { useNavigate } from 'react-router'

import { useCurrentUser, useLogout } from '../../auth/auth'
import { useThemePreference, type ThemePreference } from '../../theme/theme'
import { useInstallPrompt } from './useInstallPrompt'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

export function SettingsPage() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const [theme, setTheme] = useThemePreference()
  const install = useInstallPrompt()

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <h1 className="h1">Ajustes</h1>
      </header>

      <section className="card stack" aria-labelledby="account-title">
        <h2 id="account-title" className="h2">
          Cuenta
        </h2>
        <dl className="details">
          <div>
            <dt>Nombre</dt>
            <dd>{user?.displayName}</dd>
          </div>
          <div>
            <dt>Correo electrónico</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd>{user?.timezone}</dd>
          </div>
        </dl>
      </section>

      <section className="card stack" aria-labelledby="theme-title">
        <h2 id="theme-title" className="h2">
          Apariencia
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
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="install-title">
        <h2 id="install-title" className="h2">
          Instalar en el móvil
        </h2>
        {install.kind === 'installed' && <p className="muted">LifeOS ya está instalada en este dispositivo.</p>}
        {install.kind === 'prompt' && (
          <>
            <p className="muted">Añade LifeOS a tu pantalla de inicio para abrirla como una app.</p>
            <button type="button" className="button button-primary" onClick={() => install.install()}>
              Instalar LifeOS
            </button>
          </>
        )}
        {install.kind === 'ios' && (
          <p className="muted">
            En Safari, pulsa el botón Compartir y elige «Añadir a pantalla de inicio». Así podrás recibir
            notificaciones cuando estén disponibles.
          </p>
        )}
        {install.kind === 'manual' && (
          <p className="muted">
            Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».
          </p>
        )}
      </section>

      <button
        type="button"
        className="button button-danger-outline"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
      >
        {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
