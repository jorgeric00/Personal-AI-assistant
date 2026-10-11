import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '../../api/client'
import type { TaskKind, TaskStatus } from '../tasks/api'

export type NoteState = 'ACTIVE' | 'ARCHIVED' | 'TRASHED'
export type NoteView = 'ACTIVE' | 'FAVORITES' | 'ARCHIVED' | 'TRASH'

export const NOTE_VIEWS: NoteView[] = ['ACTIVE', 'FAVORITES', 'ARCHIVED', 'TRASH']

export interface TaskRef {
  id: string
  title: string
  kind: TaskKind
  status: TaskStatus
  dueDate: string | null
}

export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  pinned: boolean
  favorite: boolean
  state: NoteState
  tasks: TaskRef[]
  createdAt: string
  updatedAt: string
  trashedAt: string | null
}

export interface NoteSummary {
  id: string
  title: string
  excerpt: string
  tags: string[]
  pinned: boolean
  favorite: boolean
  state: NoteState
  taskCount: number
  createdAt: string
  updatedAt: string
  trashedAt: string | null
}

export interface NoteInput {
  title: string
  body: string
  tags: string[]
  taskIds: string[]
}

export interface NoteFilters {
  q?: string
  tag?: string
  pinned?: boolean
  taskId?: string
}

export interface TagCount {
  name: string
  count: number
}

export const noteKeys = {
  all: ['notes'] as const,
  list: (view: NoteView, filters: NoteFilters) => ['notes', 'list', view, filters] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
  tags: ['notes', 'tags'] as const,
}

/** Días que pasan las notas en la papelera antes de borrarse (igual que en el servidor). */
export const TRASH_RETENTION_DAYS = 30

function query(params: Record<string, string | boolean | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return search.toString()
}

export function useNotes(view: NoteView, filters: NoteFilters = {}, enabled = true) {
  return useQuery({
    queryKey: noteKeys.list(view, filters),
    queryFn: () => apiFetch<NoteSummary[]>(`/api/notes?${query({ view, ...filters })}`),
    enabled,
    placeholderData: (previous) => previous,
  })
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Note>(`/api/notes/${id}`),
    enabled: Boolean(id),
  })
}

export function useNoteTags() {
  return useQuery({ queryKey: noteKeys.tags, queryFn: () => apiFetch<TagCount[]>('/api/note-tags') })
}

export function saveNote(id: string | null, input: NoteInput) {
  return id
    ? apiFetch<Note>(`/api/notes/${id}`, { method: 'PUT', body: input })
    : apiFetch<Note>('/api/notes', { method: 'POST', body: input })
}

type NoteAction = 'archive' | 'unarchive' | 'trash' | 'restore'

/** Acciones sobre una nota que cambian su estado o sus marcas. Actualiza la caché de la nota y las listas. */
export function useNoteMutations() {
  const queryClient = useQueryClient()
  const onSuccess = (note?: Note) => {
    if (note) queryClient.setQueryData(noteKeys.detail(note.id), note)
    return queryClient.invalidateQueries({ queryKey: noteKeys.all })
  }

  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: NoteAction }) =>
      apiFetch<Note>(`/api/notes/${id}/${action}`, { method: 'POST' }),
    onSuccess,
  })
  const flags = useMutation({
    mutationFn: ({ id, ...changes }: { id: string; pinned?: boolean; favorite?: boolean }) =>
      apiFetch<Note>(`/api/notes/${id}`, { method: 'PATCH', body: changes }),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => onSuccess(),
  })
  const emptyTrash = useMutation({
    mutationFn: () => apiFetch<void>('/api/notes/trash', { method: 'DELETE' }),
    onSuccess: () => onSuccess(),
  })
  return { action, flags, remove, emptyTrash }
}
