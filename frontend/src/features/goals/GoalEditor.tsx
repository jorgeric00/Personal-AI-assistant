import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { decimalToInput, parseDecimal } from '../../lib/decimal'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { METRIC_UNITS, useExercises } from '../fitness/api'
import { useHabits } from '../habits/api'
import {
  BODY_METRICS,
  GOAL_KINDS,
  useDeleteGoal,
  useSaveGoal,
  type BodyMetric,
  type Goal,
  type GoalKind,
  type GoalStatus,
} from './api'

const STATUSES: GoalStatus[] = ['ACTIVE', 'ACHIEVED', 'DROPPED']
const DEFAULT_TARGET: Partial<Record<GoalKind, string>> = { TRAINING: '3', HABIT: '80', MEAL_PLAN: '80' }

interface GoalEditorProps {
  goal: Goal | null
  onClose: () => void
}

/** Alta y edición de un objetivo. Cada tipo pide solo lo que necesita para medir el progreso con los registros. */
export function GoalEditor({ goal, onClose }: GoalEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale, today } = useDateFormat()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'BODY')
  const [metric, setMetric] = useState<BodyMetric>(goal?.metric ?? 'WEIGHT_KG')
  const [target, setTarget] = useState(goal?.targetValue != null ? decimalToInput(goal.targetValue, locale) : '')
  const [exerciseId, setExerciseId] = useState(goal?.exerciseId ?? '')
  const [habitId, setHabitId] = useState(goal?.habitId ?? '')
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [notes, setNotes] = useState(goal?.notes ?? '')
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'ACTIVE')
  const [showErrors, setShowErrors] = useState(false)
  const exercises = useExercises(kind === 'EXERCISE')
  const habits = useHabits(today, today, kind === 'HABIT')
  const save = useSaveGoal()
  const remove = useDeleteGoal()
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}

  const parsedTarget = parseDecimal(target, 2, 4)
  const targetError =
    showErrors && kind !== 'CUSTOM' && (parsedTarget == null || parsedTarget === undefined)
      ? t('goals.form.targetInvalid')
      : serverErrors.targetValue
  const strength = (exercises.data ?? []).filter((e) => e.type === 'STRENGTH' && (!e.archived || e.id === exerciseId))
  const activeHabits = (habits.data ?? []).filter((h) => !h.archived || h.id === habitId)

  const changeKind = (next: GoalKind) => {
    setKind(next)
    setTarget(DEFAULT_TARGET[next] ?? '')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    if (kind !== 'CUSTOM' && (parsedTarget == null || parsedTarget === undefined)) {
      setShowErrors(true)
      return
    }
    save.mutate(
      {
        id: goal?.id,
        title: title.trim(),
        kind,
        metric: kind === 'BODY' ? metric : null,
        targetValue: kind === 'CUSTOM' ? null : (parsedTarget ?? null),
        exerciseId: kind === 'EXERCISE' ? exerciseId || null : null,
        habitId: kind === 'HABIT' ? habitId || null : null,
        targetDate: targetDate || null,
        notes: notes.trim() || null,
        status,
      },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  const targetField = (label: string) => (
    <Field label={label} id="goal-target" error={targetError}>
      <input
        id="goal-target"
        inputMode="decimal"
        value={target}
        aria-invalid={Boolean(targetError)}
        onChange={(e) => setTarget(e.target.value)}
      />
    </Field>
  )

  return (
    <Sheet
      title={goal ? t('goals.edit') : t('goals.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="goal-form" className="button button-primary" disabled={save.isPending || !title.trim()}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="goal-form" className="stack" onSubmit={onSubmit} noValidate>
        {save.error instanceof ApiError && Object.keys(serverErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {save.error.message}
          </div>
        )}
        <Field label={t('goals.form.title')} id="goal-title" error={serverErrors.title}>
          <input
            id="goal-title"
            data-autofocus
            maxLength={120}
            value={title}
            placeholder={t('goals.form.titlePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={t('goals.form.kind')} id="goal-kind">
          <select id="goal-kind" value={kind} onChange={(e) => changeKind(e.target.value as GoalKind)}>
            {GOAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`goals.kind.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <p className="hint">{t(`goals.kindHelp.${kind}`)}</p>

        {kind === 'BODY' && (
          <>
            <Field label={t('goals.form.metric')} id="goal-metric" error={serverErrors.metric}>
              <select id="goal-metric" value={metric} onChange={(e) => setMetric(e.target.value as BodyMetric)}>
                {(Object.keys(BODY_METRICS) as BodyMetric[]).map((m) => (
                  <option key={m} value={m}>
                    {t(`fitness.metrics.${BODY_METRICS[m]}`)}
                  </option>
                ))}
              </select>
            </Field>
            {targetField(t('goals.form.targetIn', { unit: METRIC_UNITS[BODY_METRICS[metric]] }))}
            <p className="hint">{t('goals.form.bodyDisclaimer')}</p>
          </>
        )}
        {kind === 'TRAINING' && targetField(t('goals.form.daysPerWeek'))}
        {kind === 'EXERCISE' && (
          <>
            <Field label={t('goals.form.exercise')} id="goal-exercise" error={serverErrors.exerciseId}>
              <select id="goal-exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                <option value="">{t('goals.form.choose')}</option>
                {strength.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            {targetField(t('goals.form.targetIn', { unit: 'kg' }))}
          </>
        )}
        {kind === 'HABIT' && (
          <>
            <Field label={t('goals.form.habit')} id="goal-habit" error={serverErrors.habitId}>
              <select id="goal-habit" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                <option value="">{t('goals.form.choose')}</option>
                {activeHabits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
            {habits.data && activeHabits.length === 0 && <p className="hint">{t('goals.form.noHabits')}</p>}
            {targetField(t('goals.form.targetIn', { unit: '%' }))}
          </>
        )}
        {kind === 'MEAL_PLAN' && targetField(t('goals.form.targetIn', { unit: '%' }))}

        <Field label={t('goals.form.targetDate')} id="goal-date" error={serverErrors.targetDate}>
          <input
            id="goal-date"
            type="date"
            value={targetDate}
            min={goal?.startDate ?? today}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </Field>
        <Field label={t('goals.form.notes')} id="goal-notes" error={serverErrors.notes}>
          <textarea id="goal-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {goal && (
          <div className="field">
            <span className="field-label" id="goal-status-label">
              {t('goals.form.status')}
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="goal-status-label">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  className="segmented-option"
                  onClick={() => setStatus(s)}
                >
                  {t(`goals.status.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {goal && (
        <section className="sheet-section">
          <button
            type="button"
            className="button button-danger-outline"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(goal.id, {
                onSuccess: () => {
                  toast(t('common.deleted'))
                  onClose()
                },
                onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
              })
            }
          >
            {t('common.delete')}
          </button>
        </section>
      )}
    </Sheet>
  )
}
