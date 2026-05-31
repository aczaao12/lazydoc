import { unzip, gunzip } from 'fflate'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  md: 'text/markdown',
  txt: 'text/plain',
}

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export async function extractZip(file: File): Promise<Map<string, Uint8Array>> {
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(data, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })

  const map = new Map<string, Uint8Array>()
  for (const [path, content] of Object.entries(unzipped)) {
    if (!path.startsWith('__MACOSX') && !path.includes('/__MACOSX/')) {
      map.set(path, content)
    }
  }
  return map
}

export function readArchiveText(files: Map<string, Uint8Array>, path: string): string | null {
  const data = files.get(path)
  if (!data) return null
  return new TextDecoder('utf-8').decode(data)
}

export function readArchiveBlob(files: Map<string, Uint8Array>, path: string): Blob | null {
  const data = files.get(path)
  if (!data) return null
  return new Blob([data as BlobPart], { type: getMimeType(path) })
}

async function extractGzip(file: File): Promise<Map<string, Uint8Array>> {
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  const decompressed = await new Promise<Uint8Array>((resolve, reject) => {
    gunzip(data, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })

  const name = file.name.replace(/\.(gz|gzip)$/i, '')
  const map = new Map<string, Uint8Array>()
  map.set(name, decompressed)
  return map
}

import wasmUrl from '7z-wasm/7zz.wasm?url'

async function extract7z(file: File): Promise<Map<string, Uint8Array>> {
  const { default: SevenZip } = await import('7z-wasm')

  const sevenZip = await SevenZip({
    locateFile: () => wasmUrl,
  })

  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  sevenZip.FS.writeFile('/input.7z', data)
  sevenZip.FS.mkdir('/output')
  sevenZip.callMain(['x', '/input.7z', '-o/output', '-y'])

  const result = new Map<string, Uint8Array>()

  function walk(dir: string) {
    const entries = sevenZip.FS.readdir(dir)
    for (const entry of entries) {
      if (entry === '.' || entry === '..') continue
      const fullPath = dir + '/' + entry
      try {
        const stat = sevenZip.FS.stat(fullPath)
        if (sevenZip.FS.isDir(stat.mode)) {
          walk(fullPath)
        } else {
          result.set(fullPath.replace('/output/', ''), sevenZip.FS.readFile(fullPath))
        }
      } catch {}
    }
  }

  walk('/output')
  return result
}

export async function extractArchive(file: File): Promise<Map<string, Uint8Array>> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.zip')) return extractZip(file)
  if (name.endsWith('.7z')) return extract7z(file)
  if (name.endsWith('.gz') || name.endsWith('.gzip')) return extractGzip(file)
  throw new Error(`Không hỗ trợ định dạng: ${file.name}`)
}

export function listMdFromArchive(files: Map<string, Uint8Array>): string[] {
  const paths: string[] = []
  for (const key of files.keys()) {
    if (key.endsWith('.md')) {
      paths.push(key)
    }
  }
  return paths.sort((a, b) => a.localeCompare(b))
}
