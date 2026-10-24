import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { formatDateWithYear } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { photoUrl, POSES, useDeletePhoto, useUpdatePhoto, useUploadPhoto, type Photo, type PhotoPose } from './api'
import { prepareImage } from './resize'

interface PhotoEditorProps {
  photo: Photo | null
  defaultPose: PhotoPose
  onClose: () => void
}

/** Subir una foto nueva, o ver una ya subida y cambiar su fecha, encuadre y notas. */
export function PhotoEditor({ photo, defaultPose, onClose }: PhotoEditorProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { locale, today } = useDateFormat()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [takenOn, setTakenOn] = useState(photo?.takenOn ?? today)
  const [pose, setPose] = useState<PhotoPose>(photo?.pose ?? defaultPose)
  const [notes, setNotes] = useState(photo?.notes ?? '')
  const [fileError, setFileError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const upload = useUploadPhoto()
  const update = useUpdatePhoto()
  const remove = useDeletePhoto()
  const save = photo ? update : upload
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const busy = preparing || save.isPending

  // Libera la vista previa anterior al cambiar de foto o al cerrar
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  const done = () => {
    toast(t('common.saved'))
    onClose()
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const fields = { takenOn, pose, notes: notes.trim() || null }
    if (photo) {
      update.mutate({ id: photo.id, ...fields }, { onSuccess: done })
      return
    }
    if (!file) {
      setFileError(t('photos.form.required'))
      return
    }
    setPreparing(true)
    let image: Blob
    try {
      image = await prepareImage(file)
    } catch {
      setFileError(t('photos.form.unreadable'))
      return
    } finally {
      setPreparing(false)
    }
    upload.mutate({ image, ...fields }, { onSuccess: done })
  }

  const shown = photo ? photoUrl(photo.id, 'full') : preview

  return (
    <Sheet
      title={photo ? t('photos.edit', { date: formatDateWithYear(photo.takenOn, locale) }) : t('photos.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="photo-form" className="button button-primary" disabled={busy}>
            {preparing ? t('photos.form.preparing') : save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="photo-form" className="stack" onSubmit={onSubmit} noValidate>
        {save.error instanceof ApiError && Object.keys(serverErrors).length === 0 && (
          <div className="alert alert-error" role="alert">
            {save.error.message}
          </div>
        )}
        {shown && (
          <img
            className="photo-preview"
            src={shown}
            alt={photo ? t('photos.thumbLabel', { pose: t(`photos.pose.${photo.pose}`), date: formatDateWithYear(photo.takenOn, locale) }) : t('photos.form.preview')}
          />
        )}
        {!photo && (
          <div className="field">
            <label className="button button-secondary photo-pick" htmlFor="photo-file">
              {file ? t('photos.form.change') : t('photos.form.choose')}
            </label>
            <input
              id="photo-file"
              className="visually-hidden"
              type="file"
              accept="image/*"
              aria-label={t('photos.form.file')}
              aria-invalid={Boolean(fileError ?? serverErrors.file)}
              onChange={(e) => {
                const chosen = e.target.files?.[0] ?? null
                setFile(chosen)
                setPreview(chosen ? URL.createObjectURL(chosen) : null)
                setFileError(null)
              }}
            />
            {(fileError ?? serverErrors.file) && (
              <p className="field-error" role="alert">
                {fileError ?? serverErrors.file}
              </p>
            )}
            <p className="hint">{t('photos.privacy')}</p>
          </div>
        )}
        <Field label={t('photos.form.date')} id="photo-date" error={serverErrors.takenOn}>
          <input id="photo-date" type="date" max={today} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label" id="photo-pose-label">
            {t('photos.form.pose')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="photo-pose-label">
            {POSES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={pose === option}
                className="segmented-option"
                onClick={() => setPose(option)}
              >
                {t(`photos.pose.${option}`)}
              </button>
            ))}
          </div>
        </div>
        <Field label={t('photos.form.notes')} id="photo-notes" error={serverErrors.notes}>
          <textarea
            id="photo-notes"
            rows={2}
            maxLength={500}
            value={notes}
            placeholder={t('photos.form.notesPlaceholder')}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </form>

      {photo && (
        <section className="sheet-section stack-sm">
          {confirmingDelete ? (
            <>
              <p>{t('photos.deleteConfirm')}</p>
              <div className="button-row">
                <button type="button" className="button button-ghost" onClick={() => setConfirmingDelete(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="button button-danger-outline"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(photo.id, {
                      onSuccess: () => {
                        toast(t('common.deleted'))
                        onClose()
                      },
                      onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
                    })
                  }
                >
                  {t('photos.deleteForever')}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="button button-danger-outline" onClick={() => setConfirmingDelete(true)}>
              {t('common.delete')}
            </button>
          )}
        </section>
      )}
    </Sheet>
  )
}
