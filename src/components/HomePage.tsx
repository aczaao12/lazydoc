import { useState, useEffect } from 'react'
import { getFolderEntries, removeFolderEntry, saveFolderHandle } from '../lib/db'
import type { FolderEntry } from '../lib/db'

interface Props {
  onFolderOpen: (handle: FileSystemDirectoryHandle, name: string) => void
}

export default function HomePage({ onFolderOpen }: Props) {
  const [recentFolders, setRecentFolders] = useState<FolderEntry[]>([])
  const supportsPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  useEffect(() => {
    getFolderEntries().then((entries) => {
      entries.sort((a, b) => b.openedAt - a.openedAt)
      setRecentFolders(entries)
    })
  }, [])

  const openFolder = async () => {
    if (!supportsPicker) return
    try {
      const handle = await window.showDirectoryPicker()
      const entry: FolderEntry = {
        id: handle.name,
        name: handle.name,
        handle,
        openedAt: Date.now(),
      }
      await saveFolderHandle(entry)
      onFolderOpen(handle, handle.name)
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }

  const restoreFolder = async (entry: FolderEntry) => {
    try {
      const perm = await entry.handle.queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        const result = await entry.handle.requestPermission({ mode: 'read' })
        if (result !== 'granted') return
      }
      await saveFolderHandle({ ...entry, openedAt: Date.now() })
      onFolderOpen(entry.handle, entry.name)
    } catch {
      const updated = recentFolders.filter((e) => e.id !== entry.id)
      setRecentFolders(updated)
      await removeFolderEntry(entry.id)
    }
  }

  const deleteEntry = async (id: string) => {
    setRecentFolders((prev) => prev.filter((e) => e.id !== id))
    await removeFolderEntry(id)
  }

  return (
    <div className="home-page">
      <h1 className="home-title">lazydoc</h1>
      <p className="home-subtitle">
        Học với Markdown + Quiz tương tác — đồng bộ qua thư mục máy tính
      </p>

      <div className="home-card folder-card">
        {supportsPicker ? (
          <button className="folder-btn" onClick={openFolder}>
            <span className="folder-btn-icon">📂</span>
            <span>Mở thư mục bài học</span>
          </button>
        ) : (
          <p className="browser-warn">
            Trình duyệt không hỗ trợ mở thư mục.
            Hãy dùng <strong>Chrome</strong> hoặc <strong>Edge</strong>.
          </p>
        )}
        <p className="folder-hint">
          Chọn thư mục chứa file <code>.md</code> — web sẽ tự động đồng bộ
        </p>
      </div>

      {recentFolders.length > 0 && (
        <div className="home-card recent-card">
          <h3 className="section-title">Gần đây</h3>
          <ul className="recent-list">
            {recentFolders.map((entry) => (
              <li key={entry.id} className="recent-item">
                <button className="recent-btn" onClick={() => restoreFolder(entry)}>
                  📁 {entry.name}
                </button>
                <span className="recent-time">
                  {new Date(entry.openedAt).toLocaleDateString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <button className="recent-del" onClick={() => deleteEntry(entry.id)}>
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
          <li><strong>Mở thư mục</strong> — chọn thư mục chứa file <code>.md</code></li>
          <li><strong>Chọn bài học</strong> — click vào file từ danh sách bên trái</li>
          <li><strong>Làm quiz</strong> — chọn đáp án, bấm "Kiểm tra"</li>
        </ol>
        <p className="guide-note">
          Chỉnh sửa file trong VS Code / Obsidian → Save → Web tự cập nhật
        </p>

        <h4 className="guide-subtitle">Định dạng quiz trong file <code>.md</code></h4>
        <pre className="guide-code">{'```quiz\n' + `{\n` + `  "question": "Câu hỏi...",\n` + `  "options": ["A", "B", "C", "D"],\n` + `  "correct": 2,\n` + `  "explain": "Giải thích..."\n` + `}\n` + '```'}
        </pre>
      </div>
    </div>
  )
}
