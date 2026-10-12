import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'

export type PhotoPose = 'FRONT' | 'SIDE' | 'BACK' | 'OTHER'
export const POSES: PhotoPose[] = ['FRONT', 'SIDE', 'BACK', 'OTHER']

export interface Photo {
  id: string
  takenOn: string
  pose: PhotoPose
  notes: string | null
  width: number
  height: number
}

export type PhotoFields = Pick<Photo, 'takenOn' | 'pose' | 'notes'>

const keys = { all: ['photos'] as const }

/** Fotos del más reciente al más antiguo (solo metadatos; las imágenes se piden aparte). */
export function usePhotos(enabled = true) {
  return useQuery({ queryKey: keys.all, queryFn: () => apiFetch<Photo[]>('/api/fitness/photos'), enabled })
}

/** La imagen la sirve la API solo con la sesión iniciada y sin guardarla en cachés. */
export function photoUrl(id: string, size: 'thumb' | 'full') {
  return `/api/fitness/photos/${id}/image${size === 'thumb' ? '?size=thumb' : ''}`
}

export function useUploadPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ image, ...fields }: PhotoFields & { image: Blob }) => {
      const form = new FormData()
      form.append('file', image, 'foto.jpg')
      form.append('takenOn', fields.takenOn)
      form.append('pose', fields.pose)
      if (fields.notes) form.append('notes', fields.notes)
      return apiFetch<Photo>('/api/fitness/photos', { method: 'POST', body: form })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdatePhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }: PhotoFields & { id: string }) =>
      apiFetch<Photo>(`/api/fitness/photos/${id}`, { method: 'PUT', body: fields }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeletePhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/fitness/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
