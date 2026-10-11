import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useToast } from '../../ui/toast-context'
import { CATEGORY_COLORS } from '../tasks/api'
import {
  MOVEMENT_KINDS,
  useAccounts,
  useDeleteAccount,
  useDeleteCategory,
  useFinanceCategories,
  useSaveAccount,
  useSaveCategory,
  type FinanceCategory,
  type MovementKind,
} from './api'

interface Draft {
  id?: string
  kind: MovementKind
  name: string
  color: string
  archived: boolean
}

/** Gestión de categorías (crear, renombrar, color, archivar, borrar) y de cuentas o métodos de pago. */
export function CategoriesView() {
  const { t } = useTranslation()
  const toast = useToast()
  const categories = useFinanceCategories()
  const saveCategory = useSaveCategory()
  const deleteCategory = useDeleteCategory()
  const [draft, setDraft] = useState<Draft | null>(null)

  const errorOf = (e: unknown) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : t('errors.generic'))

  const submit = () => {
    if (!draft) return
    const { id, ...input } = draft
    saveCategory.mutate(
      { id, input: { ...input, name: input.name.trim() } },
      { onSuccess: () => setDraft(null), onError: (e) => toast(errorOf(e), { tone: 'error' }) },
    )
  }

  const edit = (category: FinanceCategory) => setDraft({ ...category })

  return (
    <div className="stack-lg">
      {MOVEMENT_KINDS.map((kind) => (
        <section key={kind} className="stack-sm" aria-labelledby={`categories-${kind}`}>
          <div className="section-header">
            <h2 id={`categories-${kind}`} className="h2">
              {t(`finance.categories.${kind}`)}
            </h2>
            <button
              type="button"
              className="link link-button"
              onClick={() => setDraft({ kind, name: '', color: CATEGORY_COLORS[0], archived: false })}
            >
              {t('finance.categories.add')}
            </button>
          </div>
          <ul className="card list-plain settings-list">
            {draft && !draft.id && draft.kind === kind && (
              <li>
                <CategoryForm draft={draft} onChange={setDraft} onSubmit={submit} onCancel={() => setDraft(null)} />
              </li>
            )}
            {(categories.data ?? [])
              .filter((category) => category.kind === kind)
              .map((category) =>
                draft?.id === category.id ? (
                  <li key={category.id}>
                    <CategoryForm
                      draft={draft}
                      onChange={setDraft}
                      onSubmit={submit}
                      onCancel={() => setDraft(null)}
                      onDelete={() =>
                        deleteCategory.mutate(category.id, {
                          onSuccess: () => setDraft(null),
                          onError: (e) => toast(errorOf(e), { tone: 'error' }),
                        })
                      }
                    />
                  </li>
                ) : (
                  <li key={category.id}>
                    <button type="button" className="settings-row" onClick={() => edit(category)}>
                      <span className="category-tag">
                        <span className="category-dot" style={{ background: category.color }} aria-hidden="true" />
                        {category.name}
                      </span>
                      {category.archived && <span className="badge">{t('finance.categories.archived')}</span>}
                    </button>
                  </li>
                ),
              )}
          </ul>
        </section>
      ))}
      <AccountsSection />
    </div>
  )
}

function CategoryForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Draft
  onChange: (draft: Draft) => void
  onSubmit: () => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  return (
    <form
      className="stack-sm settings-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="field">
        <label htmlFor="category-name">{t('finance.categories.name')}</label>
        <input
          id="category-name"
          autoFocus
          maxLength={50}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
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
            onClick={() => onChange({ ...draft, color })}
          />
        ))}
      </div>
      {draft.id && (
        <label className="checkbox-row">
          <input type="checkbox" checked={draft.archived} onChange={(e) => onChange({ ...draft, archived: e.target.checked })} />
          <span>
            {t('finance.categories.archive')}
            <span className="muted small"> · {t('finance.categories.archiveHelp')}</span>
          </span>
        </label>
      )}
      <div className="inline-form">
        {onDelete && (
          <button type="button" className="button button-danger-outline button-small" onClick={onDelete}>
            {t('common.delete')}
          </button>
        )}
        <button type="button" className="button button-ghost button-small" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="button button-primary button-small" disabled={!draft.name.trim()}>
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}

function AccountsSection() {
  const { t } = useTranslation()
  const toast = useToast()
  const accounts = useAccounts()
  const save = useSaveAccount()
  const remove = useDeleteAccount()
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null)

  const submit = () => {
    if (!editing?.name.trim()) return
    save.mutate(
      { id: editing.id, name: editing.name.trim() },
      {
        onSuccess: () => setEditing(null),
        onError: (e) => toast(e instanceof ApiError ? (e.fieldErrors.name ?? e.message) : t('errors.generic'), { tone: 'error' }),
      },
    )
  }

  const form = (onDelete?: () => void) => (
    <form
      className="inline-form settings-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        aria-label={t('finance.accounts.name')}
        autoFocus
        maxLength={50}
        value={editing?.name ?? ''}
        placeholder={t('finance.form.accountPlaceholder')}
        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
      />
      {onDelete && (
        <button type="button" className="button button-danger-outline button-small" onClick={onDelete}>
          {t('common.delete')}
        </button>
      )}
      <button type="button" className="button button-ghost button-small" onClick={() => setEditing(null)}>
        {t('common.cancel')}
      </button>
      <button type="submit" className="button button-primary button-small">
        {t('common.save')}
      </button>
    </form>
  )

  return (
    <section className="stack-sm" aria-labelledby="accounts-title">
      <div className="section-header">
        <h2 id="accounts-title" className="h2">
          {t('finance.accounts.title')}
        </h2>
        <button type="button" className="link link-button" onClick={() => setEditing({ name: '' })}>
          {t('finance.accounts.add')}
        </button>
      </div>
      <p className="muted small">{t('finance.accounts.help')}</p>
      {(accounts.data?.length ?? 0) > 0 || (editing && !editing.id) ? (
        <ul className="card list-plain settings-list">
          {editing && !editing.id && <li>{form()}</li>}
          {accounts.data?.map((account) =>
            editing?.id === account.id ? (
              <li key={account.id}>{form(() => remove.mutate(account.id, { onSuccess: () => setEditing(null) }))}</li>
            ) : (
              <li key={account.id}>
                <button type="button" className="settings-row" onClick={() => setEditing({ ...account })}>
                  {account.name}
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </section>
  )
}
