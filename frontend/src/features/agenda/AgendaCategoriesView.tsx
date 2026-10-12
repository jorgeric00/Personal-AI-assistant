import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useToast } from '../../ui/toast-context'
import { CATEGORY_COLORS } from '../tasks/api'
import { useAgendaCategories, useDeleteAgendaCategory, useSaveAgendaCategory } from './api'

interface Draft {
  id?: string
  name: string
  color: string
  archived: boolean
}

/** Categorías de actividades: crear, renombrar, cambiar color, archivar o borrar si no se usan. */
export function AgendaCategoriesView() {
  const { t } = useTranslation()
  const toast = useToast()
  const categories = useAgendaCategories()
  const save = useSaveAgendaCategory()
  const remove = useDeleteAgendaCategory()
  const [draft, setDraft] = useState<Draft | null>(null)

  const errorOf = (e: unknown) =>
    e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : t('errors.generic')

  const submit = () => {
    if (!draft?.name.trim()) return
    const { id, ...input } = draft
    save.mutate(
      { id, input: { ...input, name: input.name.trim() } },
      { onSuccess: () => setDraft(null), onError: (e) => toast(errorOf(e), { tone: 'error' }) },
    )
  }

  const form = (onDelete?: () => void) =>
    draft && (
      <form
        className="stack-sm settings-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="field">
          <label htmlFor="agenda-category-name">{t('agenda.categories.name')}</label>
          <input
            id="agenda-category-name"
            autoFocus
            maxLength={50}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="color-picker" role="radiogroup" aria-label={t('tasks.form.categoryColor')}>
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={draft.color === color}
              aria-label={color}
              className="color-swatch"
              style={{ background: color }}
              onClick={() => setDraft({ ...draft, color })}
            />
          ))}
        </div>
        {draft.id && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(e) => setDraft({ ...draft, archived: e.target.checked })}
            />
            <span>
              {t('agenda.categories.archive')}
              <span className="muted small"> · {t('agenda.categories.archiveHelp')}</span>
            </span>
          </label>
        )}
        <div className="inline-form">
          {onDelete && (
            <button type="button" className="button button-danger-outline button-small" onClick={onDelete}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="button button-ghost button-small" onClick={() => setDraft(null)}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary button-small" disabled={!draft.name.trim()}>
            {t('common.save')}
          </button>
        </div>
      </form>
    )

  return (
    <section className="stack-sm" aria-labelledby="agenda-categories-title">
      <div className="section-header">
        <h2 id="agenda-categories-title" className="h2">
          {t('agenda.views.CATEGORIES')}
        </h2>
        <button
          type="button"
          className="link link-button"
          onClick={() => setDraft({ name: '', color: CATEGORY_COLORS[0], archived: false })}
        >
          {t('agenda.categories.add')}
        </button>
      </div>
      <ul className="card list-plain settings-list">
        {draft && !draft.id && <li>{form()}</li>}
        {categories.data?.map((category) =>
          draft?.id === category.id ? (
            <li key={category.id}>
              {form(() =>
                remove.mutate(category.id, {
                  onSuccess: () => setDraft(null),
                  onError: (e) => toast(errorOf(e), { tone: 'error' }),
                }),
              )}
            </li>
          ) : (
            <li key={category.id}>
              <button
                type="button"
                className="settings-row"
                onClick={() =>
                  setDraft({ id: category.id, name: category.name, color: category.color, archived: category.archived })
                }
              >
                <span className="category-tag">
                  <span className="category-dot" style={{ background: category.color }} aria-hidden="true" />
                  {category.name}
                </span>
                {category.archived && <span className="badge">{t('agenda.categories.archived')}</span>}
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
