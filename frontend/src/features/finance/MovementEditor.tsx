import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { centsToInput, parseAmount } from '../../lib/money'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { TagInput } from '../../ui/TagInput'
import { useToast } from '../../ui/toast-context'
import {
  MOVEMENT_KINDS,
  useAccounts,
  useDeleteMovement,
  useFinanceCategories,
  useFinanceTags,
  useSaveAccount,
  useSaveMovement,
  type Movement,
  type MovementKind,
} from './api'

interface MovementEditorProps {
  movement: Movement | null
  initialKind?: MovementKind
  onClose: () => void
}

export function MovementEditor({ movement, initialKind = 'EXPENSE', onClose }: MovementEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { today, locale } = useDateFormat()
  const categories = useFinanceCategories()
  const accounts = useAccounts()
  const tags = useFinanceTags()
  const save = useSaveMovement()
  const remove = useDeleteMovement()
  const saveAccount = useSaveAccount()

  const [kind, setKind] = useState<MovementKind>(movement?.kind ?? initialKind)
  const [amount, setAmount] = useState(movement ? centsToInput(movement.amountCents, locale) : '')
  const [date, setDate] = useState(movement?.date ?? today)
  const [categoryId, setCategoryId] = useState(movement?.category.id ?? '')
  const [accountId, setAccountId] = useState(movement?.account?.id ?? '')
  const [description, setDescription] = useState(movement?.description ?? '')
  const [movementTags, setMovementTags] = useState<string[]>(movement?.tags ?? [])
  const [newAccount, setNewAccount] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const error = save.error instanceof ApiError ? save.error : null
  const fieldErrors = error?.fieldErrors ?? {}
  const options = (categories.data ?? []).filter(
    (category) => category.kind === kind && (!category.archived || category.id === movement?.category.id),
  )

  const changeKind = (next: MovementKind) => {
    setKind(next)
    if (categoryId && !categories.data?.some((c) => c.id === categoryId && c.kind === next)) setCategoryId('')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const cents = parseAmount(amount)
    if (cents === null) {
      setAmountError(t('finance.form.amountInvalid'))
      return
    }
    setAmountError(null)
    save.mutate(
      {
        id: movement?.id,
        input: {
          kind,
          amountCents: cents,
          date,
          categoryId: categoryId || null,
          accountId: accountId || null,
          description: description.trim(),
          tags: movementTags,
        },
      },
      {
        onSuccess: () => {
          toast(t('common.saved'))
          onClose()
        },
      },
    )
  }

  const addAccount = () => {
    if (!newAccount?.trim()) return
    saveAccount.mutate(
      { name: newAccount.trim() },
      {
        onSuccess: (account) => {
          setAccountId(account.id)
          setNewAccount(null)
        },
        onError: (e) => toast(e instanceof ApiError ? (e.fieldErrors.name ?? e.message) : t('errors.generic'), { tone: 'error' }),
      },
    )
  }

  return (
    <Sheet
      title={movement ? t('finance.editMovement') : t(`finance.new.${kind}`)}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="movement-form" className="button button-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="movement-form" className="stack" onSubmit={onSubmit} noValidate>
        {error && Object.keys(fieldErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {error.message}
          </div>
        )}

        <div className="segmented segmented-2" role="radiogroup" aria-label={t('finance.filters.kind')}>
          {MOVEMENT_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              className="segmented-option"
              onClick={() => changeKind(option)}
            >
              {t(`finance.kind.${option}`)}
            </button>
          ))}
        </div>

        <Field label={t('finance.form.amount')} id="movement-amount" error={amountError ?? fieldErrors.amountCents}>
          <input
            id="movement-amount"
            className="amount-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder={centsToInput(0, locale)}
            data-autofocus
            value={amount}
            aria-invalid={Boolean(amountError ?? fieldErrors.amountCents)}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <div className="stack-sm">
          <span className="field-label" id="movement-category-label">
            {t('finance.form.category')}
          </span>
          <div className="chips" role="radiogroup" aria-labelledby="movement-category-label">
            {options.map((category) => (
              <button
                key={category.id}
                type="button"
                role="radio"
                aria-checked={categoryId === category.id}
                className="chip chip-category"
                onClick={() => setCategoryId(category.id)}
              >
                <span className="category-dot" style={{ background: category.color }} aria-hidden="true" />
                {category.name}
              </button>
            ))}
          </div>
          {fieldErrors.categoryId && <p className="field-error">{fieldErrors.categoryId}</p>}
        </div>

        <Field label={t('finance.form.date')} id="movement-date" error={fieldErrors.date}>
          <input id="movement-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label={t('finance.form.description')} id="movement-description" error={fieldErrors.description}>
          <input
            id="movement-description"
            value={description}
            maxLength={200}
            placeholder={t('finance.form.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="field">
          <label htmlFor="movement-account">{t('finance.form.account')}</label>
          {newAccount === null ? (
            <select
              id="movement-account"
              value={accountId}
              onChange={(e) => (e.target.value === '__new' ? setNewAccount('') : setAccountId(e.target.value))}
            >
              <option value="">{t('finance.form.noAccount')}</option>
              {accounts.data?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
              <option value="__new">{t('finance.form.newAccount')}</option>
            </select>
          ) : (
            <div className="inline-form">
              <input
                id="movement-account"
                value={newAccount}
                maxLength={50}
                placeholder={t('finance.form.accountPlaceholder')}
                onChange={(e) => setNewAccount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addAccount()
                  }
                }}
              />
              <button type="button" className="button button-secondary button-small" onClick={addAccount}>
                {t('common.add')}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => setNewAccount(null)}>
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>

        <div className="stack-sm">
          <label className="field-label" htmlFor="movement-tags">
            {t('finance.form.tags')}
          </label>
          <TagInput
            id="movement-tags"
            value={movementTags}
            onChange={setMovementTags}
            suggestions={(tags.data ?? []).map((tag) => tag.name)}
          />
          {fieldErrors.tags && <p className="field-error">{fieldErrors.tags}</p>}
        </div>
      </form>

      {movement && (
        <section className="sheet-section">
          {confirmDelete ? (
            <div className="stack" role="alert">
              <p>{t('finance.deleteConfirm')}</p>
              <div className="inline-form">
                <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(movement.id, {
                      onSuccess: () => {
                        toast(t('common.deleted'))
                        onClose()
                      },
                    })
                  }
                >
                  {t('common.confirmDelete')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button button-danger-outline" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </button>
          )}
        </section>
      )}
    </Sheet>
  )
}
