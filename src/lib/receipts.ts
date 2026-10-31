/** Where receipt photos live: this phone's own browser database (they are too big for the planner data). */
export interface ReceiptStore {
  put(id: string, blob: Blob): Promise<void>
  get(id: string): Promise<Blob | null>
  remove(id: string): Promise<void>
}

const DB_NAME = 'lp-receipts'
const STORE = 'photos'

function memoryStore(): ReceiptStore {
  const photos = new Map<string, Blob>()
  return {
    put: async (id, blob) => void photos.set(id, blob),
    get: async (id) => photos.get(id) ?? null,
    remove: async (id) => void photos.delete(id),
  }
}

let opened: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('The photo storage could not be opened.'))
  }).catch((err) => {
    opened = null
    throw err
  })
  return opened
}

/** Resolves only once the transaction has really been saved (a full phone aborts it after the request "succeeds"). */
function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        let result: T
        const req = work(tx.objectStore(STORE))
        req.onsuccess = () => {
          result = req.result
        }
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error ?? new Error('The photo could not be saved (is the phone full?).'))
        tx.onerror = () => reject(tx.error ?? new Error('The photo could not be saved.'))
      }),
  )
}

/** IndexedDB when the browser has it, otherwise photos are kept only until the page closes. */
export function createReceiptStore(): ReceiptStore {
  if (typeof indexedDB === 'undefined') return memoryStore()
  return {
    put: async (id, blob) => void (await run('readwrite', (s) => s.put(blob, id))),
    get: async (id) => ((await run('readonly', (s) => s.get(id))) as Blob | undefined) ?? null,
    remove: async (id) => void (await run('readwrite', (s) => s.delete(id))),
  }
}

export const receiptStore: ReceiptStore = createReceiptStore()

/** Shrinks a photo (longest side 1200px, JPEG) so many receipts fit on a phone. Returns the original if the browser can't. */
export async function compressImage(file: Blob, maxSide = 1200, quality = 0.7): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return out ?? file
  } catch {
    return file
  }
}
