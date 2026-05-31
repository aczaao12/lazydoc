import { unzip } from 'fflate'

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

export function listMdFromArchive(files: Map<string, Uint8Array>): string[] {
  const paths: string[] = []
  for (const key of files.keys()) {
    if (key.endsWith('.md')) {
      paths.push(key)
    }
  }
  return paths.sort((a, b) => a.localeCompare(b))
}
