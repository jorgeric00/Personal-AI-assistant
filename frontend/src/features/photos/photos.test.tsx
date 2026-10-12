import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, mockFetch, renderApp, testUser } from '../../test/utils'
import type { Photo } from './api'

vi.mock('./resize', () => ({ prepareImage: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })) }))

const csrf = () => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  return json({ headerName: 'X-XSRF-TOKEN', token: 't' })
}

const photo = (overrides: Partial<Photo>): Photo => ({
  id: 'p1',
  takenOn: '2026-10-10',
  pose: 'FRONT',
  notes: null,
  width: 1536,
  height: 2048,
  ...overrides,
})

const photos: Photo[] = [
  photo({ id: 'p3', takenOn: '2026-10-10', notes: 'Tras el verano' }),
  photo({ id: 'p2', takenOn: '2026-09-20', pose: 'SIDE' }),
  photo({ id: 'p1', takenOn: '2026-08-01' }),
]

const base = {
  'GET /api/auth/me': () => json(testUser),
  'GET /api/auth/csrf': csrf,
  'GET /api/fitness/measurements': () => json([]),
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:foto', revokeObjectURL: () => {} }))
})

afterEach(() => {
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
})

describe('diario fotográfico', () => {
  it('compara la primera y la última foto del encuadre elegido', async () => {
    mockFetch({ ...base, 'GET /api/fitness/photos': () => json(photos) })
    renderApp('/entreno?vista=PHOTOS')
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: '3 fotos' })).toBeInTheDocument()
    const thumb = screen.getByRole('button', { name: /^Perfil, 20 sept 2026/ })
    expect(thumb.querySelector('img')).toHaveAttribute('src', '/api/fitness/photos/p2/image?size=thumb')

    await user.click(screen.getByRole('button', { name: 'Frente', pressed: false }))
    const compare = screen.getByRole('heading', { name: 'Comparar' }).closest('section')!
    expect(within(compare).getByLabelText('Antes')).toHaveValue('p1')
    expect(within(compare).getByLabelText('Después')).toHaveValue('p3')
    expect(within(compare).getByRole('img', { name: /^Frente, 10 oct 2026/ })).toHaveAttribute(
      'src',
      '/api/fitness/photos/p3/image',
    )
    expect(compare).toHaveTextContent('70 días entre las dos fotos')
    expect(compare).toHaveTextContent('Tras el verano')
    expect(screen.getByRole('heading', { name: '2 fotos' })).toBeInTheDocument()

    // Con una sola foto no hay nada que comparar
    await user.click(screen.getByRole('button', { name: 'Perfil', pressed: false }))
    expect(screen.queryByRole('heading', { name: 'Comparar' })).not.toBeInTheDocument()
  })

  it('sube una foto reducida con su fecha, encuadre y notas', async () => {
    let sent: FormData | null = null
    mockFetch({
      ...base,
      'GET /api/fitness/photos': () => json([]),
      'POST /api/fitness/photos': (init) => {
        sent = init?.body as FormData
        return json(photo({ id: 'p9', pose: 'SIDE' }), 201)
      },
    })
    renderApp('/entreno?vista=PHOTOS&foto=nueva')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Nueva foto' })
    expect(within(dialog).getByText(/sin la ubicación/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('Elige una foto.')).toBeInTheDocument()

    await user.upload(within(dialog).getByLabelText('Foto'), new File(['raw'], 'IMG_0001.HEIC', { type: 'image/heic' }))
    expect(within(dialog).getByRole('img', { name: 'Vista previa' })).toHaveAttribute('src', 'blob:foto')
    await user.click(within(dialog).getByRole('radio', { name: 'Perfil' }))
    await user.type(within(dialog).getByLabelText('Notas'), 'Por la mañana')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(sent).not.toBeNull())
    const form = sent as unknown as FormData
    expect(form.get('takenOn')).toBe('2026-10-12')
    expect(form.get('pose')).toBe('SIDE')
    expect(form.get('notes')).toBe('Por la mañana')
    expect((form.get('file') as File).type).toBe('image/jpeg')
  })

  it('pide confirmación antes de borrar una foto', async () => {
    let deleted = false
    mockFetch({
      ...base,
      'GET /api/fitness/photos': () => json(photos),
      'DELETE /api/fitness/photos/p2': () => {
        deleted = true
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/entreno?vista=PHOTOS&foto=p2')
    const user = userEvent.setup()

    const dialog = await screen.findByRole('dialog', { name: 'Foto del 20 sept 2026' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/api/fitness/photos/p2/image')
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(deleted).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'Borrar foto' }))
    await waitFor(() => expect(deleted).toBe(true))
  })
})
