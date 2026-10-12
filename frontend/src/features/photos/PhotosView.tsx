import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { daysBetween, formatDateWithYear, formatShortDate } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon } from '../../ui/icons'
import { photoUrl, POSES, usePhotos, type Photo, type PhotoPose } from './api'

interface PhotosViewProps {
  pose: PhotoPose | null
  onPose: (pose: PhotoPose | null) => void
  onAdd: () => void
  onOpen: (id: string) => void
}

/**
 * Diario fotográfico: comparación de dos fotos y galería, filtradas por encuadre. Solo enseña las fotos y el tiempo
 * entre ellas; no interpreta cambios.
 */
export function PhotosView({ pose, onPose, onAdd, onOpen }: PhotosViewProps) {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const photos = usePhotos()

  if (photos.isPending) return <div className="card skeleton" aria-hidden="true" />
  if (photos.isError) {
    return (
      <div className="alert alert-error" role="alert">
        {photos.error.message}
      </div>
    )
  }
  if (photos.data.length === 0) {
    return (
      <div className="card empty-state stack">
        <p className="muted">{t('photos.empty')}</p>
        <p className="hint">{t('photos.privacy')}</p>
        <button type="button" className="button button-primary" onClick={onAdd}>
          <PlusIcon />
          {t('photos.add')}
        </button>
      </div>
    )
  }

  const shown = pose ? photos.data.filter((p) => p.pose === pose) : photos.data
  const label = (p: Photo) => t('photos.thumbLabel', { pose: t(`photos.pose.${p.pose}`), date: formatDateWithYear(p.takenOn, locale) })

  return (
    <div className="stack-lg">
      <div className="chips" role="group" aria-label={t('photos.filterLabel')}>
        <button type="button" className="chip" aria-pressed={pose === null} onClick={() => onPose(null)}>
          {t('photos.all')}
        </button>
        {POSES.map((option) => (
          <button key={option} type="button" className="chip" aria-pressed={pose === option} onClick={() => onPose(option)}>
            {t(`photos.pose.${option}`)}
          </button>
        ))}
      </div>

      {shown.length >= 2 && (
        <Compare
          key={pose ?? 'all'}
          photos={shown}
          label={label}
          option={(p) => (pose ? formatDateWithYear(p.takenOn, locale) : label(p))}
        />
      )}

      <section className="stack-sm" aria-labelledby="photos-gallery-title">
        <h2 id="photos-gallery-title" className="h2">
          {t('photos.count', { count: shown.length })}
        </h2>
        <ul className="list-plain photo-grid">
          {shown.map((photo) => (
            <li key={photo.id}>
              <button type="button" className="photo-thumb" aria-label={label(photo)} onClick={() => onOpen(photo.id)}>
                <img src={photoUrl(photo.id, 'thumb')} alt="" loading="lazy" />
                <span className="photo-thumb-caption">
                  {formatShortDate(photo.takenOn, locale)}
                  {!pose && ` · ${t(`photos.pose.${photo.pose}`)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Dos fotos lado a lado; por defecto la más antigua y la más reciente del encuadre elegido. */
function Compare({
  photos,
  label,
  option,
}: {
  photos: Photo[]
  label: (p: Photo) => string
  option: (p: Photo) => string
}) {
  const { t } = useTranslation()
  const { locale } = useDateFormat()
  const [beforeId, setBeforeId] = useState(photos[photos.length - 1].id)
  const [afterId, setAfterId] = useState(photos[0].id)
  const before = photos.find((p) => p.id === beforeId) ?? photos[photos.length - 1]
  const after = photos.find((p) => p.id === afterId) ?? photos[0]
  const days = Math.abs(daysBetween(before.takenOn, after.takenOn))

  const side = (title: string, id: string, photo: Photo, onChange: (id: string) => void) => (
    <figure className="photo-compare-side">
      <label className="field-label" htmlFor={`compare-${title}`}>
        {title}
      </label>
      <select id={`compare-${title}`} className="select" value={id} onChange={(e) => onChange(e.target.value)}>
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {option(p)}
          </option>
        ))}
      </select>
      <img src={photoUrl(photo.id, 'full')} alt={label(photo)} />
      <figcaption className="small muted">
        {formatDateWithYear(photo.takenOn, locale)}
        {photo.notes && ` · ${photo.notes}`}
      </figcaption>
    </figure>
  )

  return (
    <section className="card stack-sm" aria-labelledby="photos-compare-title">
      <h2 id="photos-compare-title" className="h2">
        {t('photos.compare.title')}
      </h2>
      <p className="hint">{t('photos.compare.help')}</p>
      <div className="photo-compare">
        {side(t('photos.compare.before'), before.id, before, setBeforeId)}
        {side(t('photos.compare.after'), after.id, after, setAfterId)}
      </div>
      <p className="small">
        {before.id === after.id ? t('photos.compare.same') : t('photos.compare.between', { count: days })}
      </p>
    </section>
  )
}
