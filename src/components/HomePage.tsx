import { useState, useEffect, useRef } from 'react'
import { extractZip } from '../lib/archive'
import { getFolderEntries, removeFolderEntry, saveFolderHandle } from '../lib/db'
import { getArchiveEntries, removeArchiveEntry, saveArchive } from '../lib/db'
import type { FolderEntry, ArchiveEntry, ArchiveFileEntry } from '../lib/db'

interface Props {
  onFolderOpen: (handle: FileSystemDirectoryHandle, name: string) => void
  onArchiveOpen: (files: Map<string, Uint8Array>, name: string) => void
}

interface RecentItem {
  id: string
  name: string
  type: 'folder' | 'archive'
  openedAt: number
}

export default function HomePage({ onFolderOpen, onArchiveOpen }: Props) {
  const [items, setItems] = useState<RecentItem[]>([])
  const zipRef = useRef<HTMLInputElement>(null)
  const supportsFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const [folders, archives] = await Promise.all([
      getFolderEntries(),
      getArchiveEntries(),
    ])

    const recent: RecentItem[] = [
      ...folders.map((f) => ({
        id: f.id,
        name: f.name,
        type: 'folder' as const,
        openedAt: f.openedAt,
      })),
      ...archives.map((a) => ({
        id: a.id,
        name: a.name,
        type: 'archive' as const,
        openedAt: a.importedAt,
      })),
    ]

    recent.sort((a, b) => b.openedAt - a.openedAt)
    setItems(recent)
  }

  async function openFolder() {
    if (!supportsFolder) return
    try {
      const handle = await window.showDirectoryPicker()
      await saveFolderHandle({
        id: handle.name,
        name: handle.name,
        handle,
        openedAt: Date.now(),
      })
      onFolderOpen(handle, handle.name)
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }

  async function restoreFolder(entry: FolderEntry) {
    try {
      const perm = await entry.handle.queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        const result = await entry.handle.requestPermission({ mode: 'read' })
        if (result !== 'granted') return
      }
      await saveFolderHandle({ ...entry, openedAt: Date.now() })
      onFolderOpen(entry.handle, entry.name)
    } catch {
      await removeFolderEntry(entry.id)
      loadHistory()
    }
  }

  async function handleZipImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const files = await extractZip(file)

      const fileArr: ArchiveFileEntry[] = []
      for (const [path, data] of files) {
        fileArr.push({ path, data: new Blob([data as BlobPart]) })
      }

      await saveArchive({
        id: file.name,
        name: file.name,
        files: fileArr,
        importedAt: Date.now(),
      })

      onArchiveOpen(files, file.name)
    } catch {
      alert('Không thể giải nén file zip. File có thể bị lỗi.')
    }

    e.target.value = ''
  }

  async function restoreArchive(entry: ArchiveEntry) {
    try {
      const map = new Map<string, Uint8Array>()
      for (const f of entry.files) {
        const buffer = await f.data.arrayBuffer()
        map.set(f.path, new Uint8Array(buffer))
      }
      await saveArchive({ ...entry, importedAt: Date.now() })
      onArchiveOpen(map, entry.name)
    } catch {
      await removeArchiveEntry(entry.id)
      loadHistory()
    }
  }

  async function deleteItem(item: RecentItem) {
    if (item.type === 'folder') {
      await removeFolderEntry(item.id)
    } else {
      await removeArchiveEntry(item.id)
    }
    loadHistory()
  }

  return (
    <div className="home-page">
      <h1 className="home-title">lazydoc</h1>
      <p className="home-subtitle">
        Học với Markdown + Quiz tương tác
      </p>

      <div className="home-card import-card">
        <div className="import-buttons">
          {supportsFolder && (
            <button className="import-btn folder-btn" onClick={openFolder}>
              <span className="import-btn-icon">📂</span>
              <span className="import-btn-label">Mở thư mục</span>
              <span className="import-btn-desc">Đồng bộ tự động</span>
            </button>
          )}

          <button className="import-btn zip-btn" onClick={() => zipRef.current?.click()}>
            <span className="import-btn-icon">📦</span>
            <span className="import-btn-label">Import .zip</span>
            <span className="import-btn-desc">Giải nén trong trình duyệt</span>
          </button>

          <input
            ref={zipRef}
            type="file"
            accept=".zip"
            hidden
            onChange={handleZipImport}
          />
        </div>
      </div>

      {items.length > 0 && (
        <div className="home-card recent-card">
          <h3 className="section-title">Gần đây</h3>
          <ul className="recent-list">
            {items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="recent-item">
                <button
                  className="recent-btn"
                  onClick={() => {
                    if (item.type === 'folder') {
                      getFolderEntries().then((entries) => {
                        const found = entries.find((e) => e.id === item.id)
                        if (found) restoreFolder(found)
                        else loadHistory()
                      })
                    } else {
                      getArchiveEntries().then((entries) => {
                        const found = entries.find((e) => e.id === item.id)
                        if (found) restoreArchive(found)
                        else loadHistory()
                      })
                    }
                  }}
                >
                  {item.type === 'folder' ? '📁' : '📦'} {item.name}
                </button>
                <span className="recent-time">
                  {new Date(item.openedAt).toLocaleDateString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <button className="recent-del" onClick={() => deleteItem(item)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="home-card guide-card">
        <h3 className="section-title">Hướng dẫn</h3>
        <ol className="guide-list">
          <li>
            <strong>Mở thư mục</strong> — chọn thư mục chứa file <code>.md</code>, tự động đồng bộ
          </li>
          <li>
            <strong>Import .zip</strong> — kéo file zip vào hoặc chọn, giải nén trong browser
          </li>
          <li>
            <strong>Chọn bài học</strong> — click vào file từ danh sách bên trái
          </li>
          <li>
            <strong>Làm quiz</strong> — chọn đáp án, bấm "Kiểm tra"
          </li>
        </ol>
        <p className="guide-note">
          Ảnh trong file .md được resolve tự động (cùng thư mục hoặc thư mục con)
        </p>

        <h4 className="guide-subtitle">Định dạng quiz</h4>
        <pre className="guide-code">{'```quiz\n' + `{\n` + `  "question": "...",\n` + `  "options": ["A", "B", "C", "D"],\n` + `  "correct": 2,\n` + `  "explain": "..."\n` + `}\n` + '```'}
        </pre>
      </div>
    </div>
  )
}
