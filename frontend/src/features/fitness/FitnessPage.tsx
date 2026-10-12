import type { ParseKeys } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { PlusIcon } from '../../ui/icons'
import { NutritionView } from '../nutrition/NutritionView'
import { NEW_PLAN } from '../nutrition/plan'
import { POSES, usePhotos, type PhotoPose } from '../photos/api'
import { PhotoEditor } from '../photos/PhotoEditor'
import { PhotosView } from '../photos/PhotosView'
import { useExercises, useMeasurements, useRoutines } from './api'
import { ExerciseEditor } from './ExerciseEditor'
import { ExercisesView } from './ExercisesView'
import { MeasurementEditor } from './MeasurementEditor'
import { ProfileView } from './ProfileView'
import { ProgressView } from './ProgressView'
import { RoutineEditor } from './RoutineEditor'
import { RoutinesView } from './RoutinesView'
import { WorkoutsView } from './WorkoutsView'

type Tab = 'WORKOUTS' | 'FOOD' | 'PROGRESS' | 'PHOTOS' | 'ROUTINES' | 'EXERCISES' | 'PROFILE'

const TABS: { value: Tab; label: ParseKeys }[] = [
  { value: 'WORKOUTS', label: 'fitness.views.workouts' },
  { value: 'ROUTINES', label: 'fitness.views.routines' },
  { value: 'FOOD', label: 'fitness.views.food' },
  { value: 'PROGRESS', label: 'fitness.views.progress' },
  { value: 'PHOTOS', label: 'fitness.views.photos' },
  { value: 'EXERCISES', label: 'fitness.views.exercises' },
  { value: 'PROFILE', label: 'fitness.views.profile' },
]

const NEW = 'nuevo'
const NEW_PHOTO = 'nueva'

/**
 * Entrenador personal. El estado vive en la URL (?vista, ?registro, ?nuevo, ?rutina, ?ejercicio, ?foto) para que el
 * acceso rápido de Hoy abra directamente el formulario.
 */
export function FitnessPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const measurements = useMeasurements()
  const tab = TABS.find((item) => item.value === params.get('vista'))?.value ?? 'WORKOUTS'
  const needsCatalog = tab === 'WORKOUTS' || tab === 'ROUTINES' || tab === 'EXERCISES' || params.has('rutina') || params.has('ejercicio')
  const exercises = useExercises(needsCatalog)
  const routines = useRoutines(needsCatalog)

  const editingId = params.get('registro')
  const creating = params.get('nuevo') === '1'
  const editing = editingId ? measurements.data?.find((m) => m.id === editingId) : undefined
  const routineParam = params.get('rutina')
  const routine = routineParam && routineParam !== NEW ? routines.data?.find((r) => r.id === routineParam) : undefined
  const exerciseParam = params.get('ejercicio')
  const exercise = exerciseParam && exerciseParam !== NEW ? exercises.data?.find((e) => e.id === exerciseParam) : undefined
  const photoParam = params.get('foto')
  const photos = usePhotos(tab === 'PHOTOS' || photoParam !== null)
  const photo = photoParam && photoParam !== NEW_PHOTO ? photos.data?.find((p) => p.id === photoParam) : undefined
  const poseParam = params.get('encuadre')
  const pose = POSES.find((p) => p === poseParam) ?? null

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const action =
    tab === 'ROUTINES' || tab === 'WORKOUTS'
      ? { label: t('fitness.routines.newShort'), open: () => update({ rutina: NEW }) }
      : tab === 'FOOD' && params.get('comidas') === 'plan'
        ? { label: t('nutrition.plan.newShort'), open: () => update({ plan: NEW_PLAN }) }
        : tab === 'FOOD'
          ? { label: t('nutrition.quickAdd'), open: () => update({ alimento: 'nuevo' }) }
          : tab === 'PHOTOS'
            ? { label: t('photos.add'), open: () => update({ foto: NEW_PHOTO }) }
            : tab === 'EXERCISES'
              ? { label: t('fitness.exercises.newShort'), open: () => update({ ejercicio: NEW }) }
              : { label: t('fitness.addEntry'), open: () => update({ nuevo: '1', registro: null }) }

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <h1 className="h1">{t('fitness.title')}</h1>
        <button type="button" className="button button-primary button-small" onClick={action.open}>
          <PlusIcon />
          {action.label}
        </button>
      </header>

      <nav className="tabs" aria-label={t('fitness.viewsLabel')}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="tab"
            aria-current={tab === item.value ? 'page' : undefined}
            onClick={() => update({ vista: item.value === 'WORKOUTS' ? null : item.value })}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {tab === 'WORKOUTS' && <WorkoutsView />}
      {tab === 'FOOD' && <NutritionView />}
      {tab === 'PROGRESS' && <ProgressView onAdd={() => update({ nuevo: '1' })} onOpen={(id) => update({ registro: id })} />}
      {tab === 'PHOTOS' && (
        <PhotosView
          pose={pose}
          onPose={(value: PhotoPose | null) => update({ encuadre: value })}
          onAdd={() => update({ foto: NEW_PHOTO })}
          onOpen={(id) => update({ foto: id })}
        />
      )}
      {tab === 'ROUTINES' && <RoutinesView onAdd={() => update({ rutina: NEW })} onOpen={(id) => update({ rutina: id })} />}
      {tab === 'EXERCISES' && <ExercisesView onOpen={(id) => update({ ejercicio: id })} />}
      {tab === 'PROFILE' && <ProfileView />}

      {(photoParam === NEW_PHOTO || photo) && (
        <PhotoEditor
          key={photoParam}
          photo={photo ?? null}
          defaultPose={pose ?? 'FRONT'}
          onClose={() => update({ foto: null })}
        />
      )}
      {measurements.data && (creating || editing) && (
        <MeasurementEditor
          key={editingId ?? 'new'}
          measurement={editing ?? null}
          existing={measurements.data}
          onClose={() => update({ registro: null, nuevo: null })}
        />
      )}
      {exercises.data && routines.data && (routineParam === NEW || routine) && (
        <RoutineEditor
          key={routineParam}
          routine={routine ?? null}
          exercises={exercises.data}
          onClose={() => update({ rutina: null })}
        />
      )}
      {exercises.data && (exerciseParam === NEW || exercise) && (
        <ExerciseEditor key={exerciseParam} exercise={exercise ?? null} onClose={() => update({ ejercicio: null })} />
      )}
    </div>
  )
}
