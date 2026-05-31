interface MdHandle {
  path: string
  handle: FileSystemFileHandle
}

export async function walkMdFiles(dir: FileSystemDirectoryHandle, prefix = ''): Promise<MdHandle[]> {
  const result: MdHandle[] = []
  for await (const [name, entry] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (entry.kind === 'directory') {
      const sub = await walkMdFiles(entry as FileSystemDirectoryHandle, path)
      result.push(...sub)
    } else if (name.endsWith('.md')) {
      result.push({ path, handle: entry as FileSystemFileHandle })
    }
  }
  return result
}

export async function readFileText(dir: FileSystemDirectoryHandle, filePath: string): Promise<string> {
  const parts = filePath.split('/')
  let current = dir
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i])
  }
  const handle = await current.getFileHandle(parts[parts.length - 1])
  const file = await handle.getFile()
  return file.text()
}

export async function readFileBlob(dir: FileSystemDirectoryHandle, filePath: string): Promise<Blob | null> {
  try {
    const parts = filePath.split('/')
    let current = dir
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i])
    }
    const handle = await current.getFileHandle(parts[parts.length - 1])
    return await handle.getFile()
  } catch {
    return null
  }
}
