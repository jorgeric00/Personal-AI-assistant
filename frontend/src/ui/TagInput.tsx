import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { CloseIcon } from './icons'

interface TagInputProps {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  readOnly?: boolean
}

/** Igual que en el servidor: minúsculas, sin «#» inicial y con los espacios agrupados. */
function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Campo de etiquetas: se añaden con Intro o coma y se quitan con su botón o con Retroceso. */
export function TagInput({ id, value, onChange, suggestions, readOnly = false }: TagInputProps) {
  const { t } = useTranslation()
  const listId = useId()
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const tags = raw.split(',').map(normalizeTag).filter(Boolean)
    const next = [...value]
    tags.forEach((tag) => {
      if (!next.includes(tag)) next.push(tag)
    })
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && text.trim()) {
      event.preventDefault()
      add(text)
    } else if (event.key === 'Enter') {
      event.preventDefault()
    } else if (event.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span key={tag} className="tag">
          #{tag}
          {!readOnly && (
            <button
              type="button"
              className="tag-remove"
              aria-label={t('common.tags.remove', { tag })}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <CloseIcon />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <>
          <input
            id={id}
            value={text}
            list={listId}
            placeholder={value.length === 0 ? t('common.tags.placeholder') : t('common.tags.add')}
            autoCapitalize="none"
            enterKeyHint="done"
            onChange={(event) => {
              const next = event.target.value
              // Al elegir una sugerencia de la lista se añade directamente.
              if (suggestions.includes(next)) add(next)
              else if (next.endsWith(',')) add(next)
              else setText(next)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => text.trim() && add(text)}
          />
          <datalist id={listId}>
            {suggestions
              .filter((tag) => !value.includes(tag))
              .map((tag) => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
        </>
      )}
    </div>
  )
}
