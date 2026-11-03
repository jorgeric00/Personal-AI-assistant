/** Dónde se guarda la copia de la base de datos entre usos de la app. */
export interface DatabaseStorage {
  load(): Promise<Uint8Array | null>
  save(bytes: Uint8Array): Promise<void>
}

const DB_NAME = 'lifeos'
const STORE = 'database'
const KEY = 'main'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** IndexedDB del WebView: es almacenamiento privado de la app y se conserva hasta desinstalarla o borrar sus datos. */
export function indexedDbStorage(): DatabaseStorage {
  const database = open()
  return {
    async load() {
      const db = await database
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).get(KEY)
        request.onsuccess = () => resolve((request.result as Uint8Array | undefined) ?? null)
        request.onerror = () => reject(request.error)
      })
    },
    async save(bytes) {
      const db = await database
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite')
        transaction.objectStore(STORE).put(bytes, KEY)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    },
  }
}

export function memoryStorage(initial: Uint8Array | null = null): DatabaseStorage & { bytes: Uint8Array | null } {
  return {
    bytes: initial,
    async load() {
      return this.bytes
    },
    async save(bytes) {
      this.bytes = bytes
    },
  }
}
