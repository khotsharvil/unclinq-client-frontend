/**
 * recordingStore — persists in-progress recording chunks to IndexedDB so a long
 * session survives a phone call, an accidental lock, a Safari crash, or an iOS
 * low-memory kill. Each MediaRecorder chunk is appended as it arrives; if the
 * recording is interrupted, whatever was captured can be recovered and uploaded
 * on next open. Audio never leaves the device until the single finalize upload.
 *
 * One recording at a time. `uc_rec_meta` (localStorage) marks an active/unfinished
 * recording so the page can offer recovery.
 */

const DB_NAME = 'unclinq_rec'
const STORE = 'chunks'
const META_KEY = 'uc_rec_meta'

export function recStoreSupported() {
  return typeof indexedDB !== 'undefined'
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    let result
    Promise.resolve(fn(store)).then((r) => { result = r })
    t.oncomplete = () => { db.close(); resolve(result) }
    t.onerror = () => { db.close(); reject(t.error) }
    t.onabort = () => { db.close(); reject(t.error) }
  })
}

// Append one chunk (Blob). autoIncrement keys preserve insertion order.
export async function appendChunk(blob) {
  const db = await openDB()
  return tx(db, 'readwrite', (store) => store.add(blob))
}

// All chunks, in recorded order.
export async function getAllChunks() {
  const db = await openDB()
  return tx(db, 'readonly', (store) => new Promise((res) => {
    const rq = store.getAll()
    rq.onsuccess = () => res(rq.result || [])
    rq.onerror = () => res([])
  }))
}

export async function clearChunks() {
  const db = await openDB()
  return tx(db, 'readwrite', (store) => store.clear())
}

// ── Active-recording marker ────────────────────────────────────────────────
export function setActiveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify({ ...meta, at: Date.now() })) } catch { /* ignore */ }
}
export function getActiveMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || 'null') } catch { return null }
}
export function clearActiveMeta() {
  try { localStorage.removeItem(META_KEY) } catch { /* ignore */ }
}
