import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { ApiError } from '../api/client'
import { useCurrentUser, useLogin } from './auth'

export function LoginPage() {
  const { data: user } = useCurrentUser()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const error = login.error instanceof ApiError ? login.error : null
  const fieldErrors = error?.fieldErrors ?? {}

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => navigate(from, { replace: true }) },
    )
  }

  return (
    <main className="login">
      <div className="login-card card">
        <img src="/icons/icon-192.png" alt="" className="login-logo" width={56} height={56} />
        <h1 className="h1">LifeOS</h1>
        <p className="muted">{t('login.subtitle')}</p>

        <form className="stack" onSubmit={onSubmit} noValidate>
          {error && Object.keys(fieldErrors).length === 0 && (
            <div className="alert alert-error" role="alert">
              {error.message}
            </div>
          )}

          <div className="field">
            <label htmlFor="email">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="field-error">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" className="field-error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button type="submit" className="button button-primary button-block" disabled={login.isPending}>
            {login.isPending ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
