export function resolveRelativePath(basePath: string, relative: string): string {
  const parts = basePath.split('/')
  parts.pop()
  for (const p of relative.replace(/\\/g, '/').split('/')) {
    if (p === '.' || p === '') continue
    if (p === '..') { if (parts.length > 0) parts.pop(); continue }
    parts.push(p)
  }
  return parts.join('/')
}
