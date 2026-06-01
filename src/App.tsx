import { useState, useEffect, useRef, useCallback } from 'react'
import HomePage from './components/HomePage'
import FileSidebar from './components/FileSidebar'
import MarkdownViewer from './components/MarkdownViewer'
import { walkMdFiles, readFileText, readFileBlob } from './lib/folder'
import { readArchiveText, listMdFromArchive, readArchiveBlob } from './lib/archive'
import { resolveRelativePath } from './lib/path'
import type { MdFileEntry } from './types'
import './App.css'

type Source =
  | { type: 'folder'; handle: FileSystemDirectoryHandle; name: string }
  | { type: 'archive'; name: string; files: Map<string, Uint8Array> }

export default function App() {
  const [source, setSource] = useState<Source | null>(null)
  const [files, setFiles] = useState<MdFileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sourceRef = useRef(source)
  sourceRef.current = source
  const selectedRef = useRef(selectedFile)
  selectedRef.current = selectedFile

  const loadFile = useCallback(async (path: string) => {
    const s = sourceRef.current
    if (!s) return
    try {
      let content: string | null = null
      if (s.type === 'folder') {
        content = await readFileText(s.handle, path)
      } else {
        content = readArchiveText(s.files, path)
      }
      if (content !== null) {
        setSelectedFile(path)
        setFileContent(content)
      }
    } catch {
      // ignore
    }
  }, [])

  const resolveImage = useCallback(
    async (mdPath: string, src: string): Promise<string | null> => {
      const s = sourceRef.current
      if (!s) return null

      const resolved = resolveRelativePath(mdPath, src)

      if (s.type === 'folder') {
        const blob = await readFileBlob(s.handle, resolved)
        return blob ? URL.createObjectURL(blob) : null
      }

      const blob = readArchiveBlob(s.files, resolved)
      return blob ? URL.createObjectURL(blob) : null
    },
    [],
  )

  const handleSelect = useCallback((path: string) => {
    loadFile(path)
    setSidebarOpen(false)
  }, [loadFile])

  const goHome = useCallback(() => {
    setSource(null)
    setFiles([])
    setSelectedFile(null)
    setFileContent(null)
  }, [])

  const handleFolderOpen = useCallback(
    (handle: FileSystemDirectoryHandle, name: string) => {
      setSource({ type: 'folder', handle, name })
      setFiles([])
      setSelectedFile(null)
      setFileContent(null)
    },
    [],
  )

  const handleArchiveOpen = useCallback(
    (files: Map<string, Uint8Array>, name: string) => {
      setSource({ type: 'archive', files, name })
      setFiles([])
      setSelectedFile(null)
      setFileContent(null)
    },
    [],
  )

  // ─── Folder: poll for changes ───
  useEffect(() => {
    if (!source || source.type !== 'folder') return

    const mtimes = new Map<string, number>()

    const poll = async () => {
      const s = sourceRef.current
      if (!s || s.type !== 'folder') return

      const entries: MdFileEntry[] = []
      let selectedChanged = false
      const selName = selectedRef.current

      const handles = await walkMdFiles(s.handle)
      for (const md of handles) {
        const file = await md.handle.getFile()
        entries.push({ path: md.path, lastModified: file.lastModified })

        if (md.path === selName && mtimes.get(md.path) !== file.lastModified) {
          selectedChanged = true
        }
      }

      entries.sort((a, b) => a.path.localeCompare(b.path))
      setFiles(entries)

      if (selectedChanged && selName) {
        const content = await readFileText(s.handle, selName)
        setFileContent(content)
      }
    }

    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [source])

  // ─── Archive: build file list once ───
  useEffect(() => {
    if (!source || source.type !== 'archive') return

    const mdFiles = listMdFromArchive(source.files)
    setFiles(mdFiles.map((path) => ({ path, lastModified: 0 })))
  }, [source])

  // ─── Render ───
  if (!source) {
    return (
      <div className="app">
        <HomePage
          onFolderOpen={handleFolderOpen}
          onArchiveOpen={handleArchiveOpen}
        />
      </div>
    )
  }

  return (
    <div className="app app-reader">
      <header className="app-header">
        <div className="header-left">
          <button className="menu-btn" onClick={() => setSidebarOpen(v => !v)}>☰</button>
          <span className="header-title">lazydoc</span>
          <span className="header-folder">
            {source.type === 'folder' ? '📁' : '📦'} {source.name}
          </span>
        </div>
        <button className="back-btn" onClick={goHome}>Trang chủ</button>
      </header>
      <div className={`reader-layout${sidebarOpen ? ' sidebar-open' : ''}`}>
        <FileSidebar
          files={files}
          selectedFile={selectedFile}
          onSelect={handleSelect}
        />
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <main className="markdown-container">
          {fileContent ? (
            <MarkdownViewer
              content={fileContent}
              mdPath={selectedFile || ''}
              resolveImage={resolveImage}
            />
          ) : (
            <div className="no-file-hint">
              <p>Chọn một file .md từ danh sách bên trái</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
