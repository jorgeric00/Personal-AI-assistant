import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'

import { MIGRATIONS } from './migrations'
import { failure, openTestApi } from './testing'

describe('copia de seguridad de la app', () => {
  it('restaura todos los datos de una copia y los guarda', async () => {
    const original = await openTestApi()
    await original.send('POST', '/api/notes', { title: 'Guardada en la copia' })
    const backup = await original.api.exportBackup()

    const other = await openTestApi()
    await other.send('POST', '/api/notes', { title: 'Se perderá' })
    await other.api.restoreBackup(backup)
    expect((await other.get('/api/notes')).map((n: any) => n.title)).toEqual(['Guardada en la copia'])

    // Tras reabrir la app siguen los datos restaurados.
    const reopened = await openTestApi('2026-10-14T09:00:00Z', other.storage)
    expect((await reopened.get('/api/notes')).map((n: any) => n.title)).toEqual(['Guardada en la copia'])
  })

  it('rechaza archivos que no son copias de LifeOS sin tocar los datos', async () => {
    const { api, get, send } = await openTestApi()
    await send('POST', '/api/notes', { title: 'Sigue aquí' })
    expect((await failure(api.restoreBackup(new TextEncoder().encode('hola')))).code).toBe('backup-invalid')

    const sql = await initSqlJs()
    const foreign = new sql.Database()
    foreign.run('create table cosas (id integer)')
    expect((await failure(api.restoreBackup(foreign.export()))).code).toBe('backup-invalid')

    const backup = await api.exportBackup()
    const newer = new sql.Database(backup)
    newer.run(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
    expect((await failure(api.restoreBackup(newer.export()))).code).toBe('backup-newer')

    expect((await get('/api/notes')).map((n: any) => n.title)).toEqual(['Sigue aquí'])
  })

  it('pone al día una copia hecha con una versión anterior de la app', async () => {
    const sql = await initSqlJs()
    const old = new sql.Database()
    old.exec(MIGRATIONS[0])
    old.run("insert into app_setting (key, value) values ('app', 'lifeos')")
    old.run('PRAGMA user_version = 1')
    const { api, get } = await openTestApi()
    await api.restoreBackup(old.export())
    expect(await get('/api/notes')).toEqual([])
  })
})
