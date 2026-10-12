import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { formatDateWithYear } from '../../lib/date'
import { decimalToInput, formatDecimal, parseDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { useToast } from '../../ui/toast-context'
import {
  ACTIVITY_LEVELS,
  EXPERIENCES,
  GOALS,
  useProfile,
  useSaveProfile,
  type ActivityLevel,
  type Experience,
  type Goal,
  type Profile,
} from './api'

interface Form {
  birthDate: string
  heightCm: string
  startWeightKg: string
  goal: Goal | ''
  goalDetails: string
  activityLevel: ActivityLevel | ''
  experience: Experience | ''
  daysPerWeek: string
  minutesPerSession: string
  equipment: string
  foodPreferences: string
  foodAvoid: string
  notes: string
}

function toForm(profile: Profile, locale: string): Form {
  return {
    birthDate: profile.birthDate ?? '',
    heightCm: decimalToInput(profile.heightCm, locale),
    startWeightKg: decimalToInput(profile.startWeightKg, locale),
    goal: profile.goal ?? '',
    goalDetails: profile.goalDetails ?? '',
    activityLevel: profile.activityLevel ?? '',
    experience: profile.experience ?? '',
    daysPerWeek: profile.daysPerWeek === null ? '' : String(profile.daysPerWeek),
    minutesPerSession: profile.minutesPerSession === null ? '' : String(profile.minutesPerSession),
    equipment: profile.equipment ?? '',
    foodPreferences: profile.foodPreferences ?? '',
    foodAvoid: profile.foodAvoid ?? '',
    notes: profile.notes ?? '',
  }
}

/** Perfil físico y objetivos. Todo es opcional: no se asume ningún dato. */
export function ProfileView() {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const profile = useProfile()

  if (profile.isPending) {
    return (
      <div className="screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  if (profile.isError) {
    return (
      <div className="alert alert-error" role="alert">
        {profile.error.message}
      </div>
    )
  }
  return <ProfileForm key={JSON.stringify(profile.data)} profile={profile.data} locale={locale} />
}

function ProfileForm({ profile, locale }: { profile: Profile; locale: string }) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSaveProfile()
  const [form, setForm] = useState<Form>(() => toForm(profile, locale))
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  const error = save.error instanceof ApiError ? save.error : null
  const errors: Record<string, string | undefined> = { ...(error?.fieldErrors ?? {}), ...localErrors }
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const height = parseDecimal(form.heightCm, 1)
    const weight = parseDecimal(form.startWeightKg, 2)
    const minutes = form.minutesPerSession.trim() === '' ? undefined : Number(form.minutesPerSession)
    const nextErrors: Record<string, string> = {}
    if (height === null) nextErrors.heightCm = t('fitness.form.invalidNumber', { count: 1 })
    if (weight === null) nextErrors.startWeightKg = t('fitness.form.invalidNumber', { count: 2 })
    if (minutes !== undefined && !Number.isInteger(minutes)) nextErrors.minutesPerSession = t('fitness.profile.minutesInvalid')
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const text = (value: string) => value.trim() || null
    save.mutate(
      {
        birthDate: form.birthDate || null,
        heightCm: height ?? null,
        startWeightKg: weight ?? null,
        goal: form.goal || null,
        goalDetails: text(form.goalDetails),
        activityLevel: form.activityLevel || null,
        experience: form.experience || null,
        daysPerWeek: form.daysPerWeek === '' ? null : Number(form.daysPerWeek),
        minutesPerSession: minutes ?? null,
        equipment: text(form.equipment),
        foodPreferences: text(form.foodPreferences),
        foodAvoid: text(form.foodAvoid),
        notes: text(form.notes),
      },
      { onSuccess: () => toast(t('common.saved')) },
    )
  }

  const textarea = (key: 'goalDetails' | 'equipment' | 'foodPreferences' | 'foodAvoid' | 'notes', max: number, placeholder?: string) => (
    <Field label={t(`fitness.profile.${key}`)} id={`profile-${key}`} error={errors[key]}>
      <textarea
        id={`profile-${key}`}
        rows={2}
        maxLength={max}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  )

  return (
    <form className="stack-lg" onSubmit={onSubmit} noValidate>
      {(profile.age !== null || profile.currentWeightKg !== null) && (
        <div className="stat-grid stat-grid-2">
          {profile.age !== null && (
            <div className="card stat">
              <span className="stat-label">{t('fitness.profile.age')}</span>
              <span className="stat-value">{t('fitness.profile.years', { count: profile.age })}</span>
            </div>
          )}
          {profile.currentWeightKg !== null && (
            <div className="card stat">
              <span className="stat-label">{t('fitness.profile.currentWeight')}</span>
              <span className="stat-value">{formatDecimal(profile.currentWeightKg, locale, 2)} kg</span>
              <span className="muted small">
                {profile.currentWeightDate
                  ? formatDateWithYear(profile.currentWeightDate, locale)
                  : t('fitness.profile.fromStartWeight')}
              </span>
            </div>
          )}
        </div>
      )}

      {error && Object.keys(error.fieldErrors).length === 0 && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      <section className="card stack" aria-labelledby="profile-body">
        <h2 id="profile-body" className="h3">
          {t('fitness.profile.body')}
        </h2>
        <Field label={t('fitness.profile.birthDate')} id="profile-birthDate" error={errors.birthDate}>
          <input id="profile-birthDate" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        </Field>
        <div className="field-row">
          <Field label={t('fitness.profile.heightCm')} id="profile-heightCm" error={errors.heightCm}>
            <input id="profile-heightCm" inputMode="decimal" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
          </Field>
          <Field label={t('fitness.profile.startWeightKg')} id="profile-startWeightKg" error={errors.startWeightKg}>
            <input
              id="profile-startWeightKg"
              inputMode="decimal"
              value={form.startWeightKg}
              onChange={(e) => set('startWeightKg', e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="card stack" aria-labelledby="profile-goal">
        <h2 id="profile-goal" className="h3">
          {t('fitness.profile.goalTitle')}
        </h2>
        <Field label={t('fitness.profile.goal')} id="profile-goal-select" error={errors.goal}>
          <select id="profile-goal-select" value={form.goal} onChange={(e) => set('goal', e.target.value as Goal | '')}>
            <option value="">{t('fitness.profile.notSet')}</option>
            {GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {t(`fitness.goals.${goal}`)}
              </option>
            ))}
          </select>
        </Field>
        {textarea('goalDetails', 500, t('fitness.profile.goalDetailsPlaceholder'))}
      </section>

      <section className="card stack" aria-labelledby="profile-training">
        <h2 id="profile-training" className="h3">
          {t('fitness.profile.training')}
        </h2>
        <div className="field-row">
          <Field label={t('fitness.profile.activityLevel')} id="profile-activity" error={errors.activityLevel}>
            <select
              id="profile-activity"
              value={form.activityLevel}
              onChange={(e) => set('activityLevel', e.target.value as ActivityLevel | '')}
            >
              <option value="">{t('fitness.profile.notSet')}</option>
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`fitness.activity.${level}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fitness.profile.experience')} id="profile-experience" error={errors.experience}>
            <select
              id="profile-experience"
              value={form.experience}
              onChange={(e) => set('experience', e.target.value as Experience | '')}
            >
              <option value="">{t('fitness.profile.notSet')}</option>
              {EXPERIENCES.map((level) => (
                <option key={level} value={level}>
                  {t(`fitness.experience.${level}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label={t('fitness.profile.daysPerWeek')} id="profile-days" error={errors.daysPerWeek}>
            <select id="profile-days" value={form.daysPerWeek} onChange={(e) => set('daysPerWeek', e.target.value)}>
              <option value="">{t('fitness.profile.notSet')}</option>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fitness.profile.minutesPerSession')} id="profile-minutes" error={errors.minutesPerSession}>
            <input
              id="profile-minutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={600}
              value={form.minutesPerSession}
              onChange={(e) => set('minutesPerSession', e.target.value)}
            />
          </Field>
        </div>
        {textarea('equipment', 1000, t('fitness.profile.equipmentPlaceholder'))}
      </section>

      <section className="card stack" aria-labelledby="profile-food">
        <h2 id="profile-food" className="h3">
          {t('fitness.profile.food')}
        </h2>
        {textarea('foodPreferences', 1000, t('fitness.profile.foodPreferencesPlaceholder'))}
        {textarea('foodAvoid', 1000, t('fitness.profile.foodAvoidPlaceholder'))}
      </section>

      <section className="card stack" aria-labelledby="profile-other">
        <h2 id="profile-other" className="h3">
          {t('fitness.profile.other')}
        </h2>
        {textarea('notes', 2000)}
      </section>

      <p className="muted small">{t('fitness.profile.disclaimer')}</p>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}
