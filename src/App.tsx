import { useState, useEffect, useRef, useCallback } from 'react'
import HomePage from './components/HomePage'
import FileSidebar from './components/FileSidebar'
import MarkdownViewer from './components/MarkdownViewer'
import type { FileInfo } from './types'
import './App.css'

export default function App() {
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)
  const [folderName, setFolderName] = useState('')
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)

  const folderRef = useRef(folder)
  folderRef.current = folder
  const selectedRef = useRef(selectedFile)
  selectedRef.current = selectedFile

  const loadFile = useCallback(async (name: string) => {
    const f = folderRef.current
    if (!f) return
    try {
      const handle = await f.getFileHandle(name)
      const file = await handle.getFile()
      setSelectedFile(name)
      setFileContent(await file.text())
    } catch {
      // ignore
    }
  }, [])

  const handleFolderOpen = useCallback((handle: FileSystemDirectoryHandle, name: string) => {
    setFolder(handle)
    setFolderName(name)
    setSelectedFile(null)
    setFileContent(null)
    setFiles([])
  }, [])

  useEffect(() => {
    if (!folder) return

    const mtimes = new Map<string, number>()

    const poll = async () => {
      const f = folderRef.current
      if (!f) return

      const entries: FileInfo[] = []
      let selectedChanged = false
      const selName = selectedRef.current

      for await (const [name, entry] of f.entries()) {
        if (entry.kind === 'file' && name.endsWith('.md')) {
          const handle = await f.getFileHandle(name)
          const file = await handle.getFile()
          entries.push({ name, lastModified: file.lastModified })

          if (name === selName) {
            if (mtimes.get(name) !== file.lastModified) {
              selectedChanged = true
            }
          }
        }
      }

      entries.sort((a, b) => a.name.localeCompare(b.name))
      setFiles(entries)

      if (selectedChanged && selName) {
        const handle = await f.getFileHandle(selName)
        const file = await handle.getFile()
        setFileContent(await file.text())
      }
    }

    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [folder])

  const goHome = useCallback(() => {
    setFolder(null)
    setFolderName('')
    setSelectedFile(null)
    setFileContent(null)
    setFiles([])
  }, [])

  if (!folder) {
    return (
      <div className="app">
        <HomePage onFolderOpen={handleFolderOpen} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="header-title">lazydoc</span>
          <span className="header-folder">{folderName}</span>
        </div>
        <button className="back-btn" onClick={goHome}>Trang chủ</button>
      </header>
      <div className="reader-layout">
        <FileSidebar
          files={files}
          selectedFile={selectedFile}
          onSelect={loadFile}
        />
        <main className="markdown-container">
          {fileContent ? (
            <MarkdownViewer content={fileContent} />
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
