import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchIcon } from '../../ui/icons'
import { MUSCLE_GROUPS, useExercises, type MuscleGroup } from './api'

/** Catálogo de ejercicios agrupado por grupo muscular, con búsqueda y filtro. */
export function ExercisesView({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const exercises = useExercises()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  if (exercises.isPending) {
    return (
      <div className="screen-center-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    )
  }
  if (exercises.isError) {
    return (
      <div className="alert alert-error" role="alert">
        {exercises.error.message}
      </div>
    )
  }

  const query = search.trim().toLocaleLowerCase()
  const archivedCount = exercises.data.filter((e) => e.archived).length
  const visible = exercises.data.filter(
    (e) =>
      (showArchived || !e.archived) &&
      (!group || e.muscleGroup === group) &&
      (!query || e.name.toLocaleLowerCase().includes(query) || e.equipment?.toLocaleLowerCase().includes(query)),
  )
  const groups = MUSCLE_GROUPS.filter((g) => exercises.data.some((e) => e.muscleGroup === g))

  return (
    <div className="stack">
      <label className="search-field">
        <SearchIcon />
        <span className="visually-hidden">{t('fitness.exercises.search')}</span>
        <input
          type="search"
          value={search}
          placeholder={t('fitness.exercises.search')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="chips chips-scroll" role="group" aria-label={t('fitness.exercises.group')}>
        <button type="button" className="chip chip-small" aria-pressed={group === null} onClick={() => setGroup(null)}>
          {t('fitness.exercises.allGroups')}
        </button>
        {groups.map((g) => (
          <button key={g} type="button" className="chip chip-small" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {t(`fitness.groups.${g}`)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card empty-state">
          <p className="muted">{t('fitness.exercises.empty')}</p>
        </div>
      ) : (
        MUSCLE_GROUPS.filter((g) => visible.some((e) => e.muscleGroup === g)).map((g) => (
          <section key={g} className="stack-sm" aria-labelledby={`group-${g}`}>
            <h2 id={`group-${g}`} className="h3">
              {t(`fitness.groups.${g}`)}
            </h2>
            <ul className="card list-plain movement-list">
              {visible
                .filter((e) => e.muscleGroup === g)
                .map((exercise) => (
                  <li key={exercise.id}>
                    <button type="button" className="movement-row" onClick={() => onOpen(exercise.id)}>
                      <span className="movement-main">
                        <span className="movement-title">
                          {exercise.name}
                          {exercise.archived && <span className="badge">{t('fitness.exercises.archived')}</span>}
                        </span>
                        <span className="movement-meta">
                          {[t(`fitness.types.${exercise.type}`), exercise.equipment].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}

      {archivedCount > 0 && (
        <button type="button" className="link link-button" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t('fitness.exercises.hideArchived') : t('fitness.exercises.showArchived', { count: archivedCount })}
        </button>
      )}
      <p className="muted small">{t('fitness.exercises.disclaimer')}</p>
    </div>
  )
}
