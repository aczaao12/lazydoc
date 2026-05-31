const DB_NAME = 'lazydoc'
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('archives')) {
        db.createObjectStore('archives', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Folder entries ───

export interface FolderEntry {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  openedAt: number
}

export async function saveFolderHandle(entry: FolderEntry) {
  const db = await openDB()
  const tx = db.transaction('folders', 'readwrite')
  tx.objectStore('folders').put(entry)
  await txPromise(tx)
}

export async function getFolderEntries(): Promise<FolderEntry[]> {
  const db = await openDB()
  const tx = db.transaction('folders', 'readonly')
  const req = tx.objectStore('folders').getAll()
  return new Promise((resolve) => { req.onsuccess = () => resolve(req.result) })
}

export async function removeFolderEntry(id: string) {
  const db = await openDB()
  const tx = db.transaction('folders', 'readwrite')
  tx.objectStore('folders').delete(id)
  await txPromise(tx)
}

// ─── Archive entries ───

export interface ArchiveFileEntry {
  path: string
  data: Blob
}

export interface ArchiveEntry {
  id: string
  name: string
  files: ArchiveFileEntry[]
  importedAt: number
}

export async function saveArchive(entry: ArchiveEntry) {
  const db = await openDB()
  const tx = db.transaction('archives', 'readwrite')
  tx.objectStore('archives').put(entry)
  await txPromise(tx)
}

export async function getArchiveEntries(): Promise<ArchiveEntry[]> {
  const db = await openDB()
  const tx = db.transaction('archives', 'readonly')
  const req = tx.objectStore('archives').getAll()
  return new Promise((resolve) => { req.onsuccess = () => resolve(req.result) })
}

export async function removeArchiveEntry(id: string) {
  const db = await openDB()
  const tx = db.transaction('archives', 'readwrite')
  tx.objectStore('archives').delete(id)
  await txPromise(tx)
}
