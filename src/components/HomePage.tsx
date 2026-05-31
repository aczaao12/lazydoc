import { useState, useEffect, useRef, useCallback } from 'react'
import { extractArchive } from '../lib/archive'
import { getFolderEntries, removeFolderEntry, saveFolderHandle } from '../lib/db'
import { getArchiveEntries, removeArchiveEntry, saveArchive } from '../lib/db'
import type { FolderEntry, ArchiveEntry, ArchiveFileEntry } from '../lib/db'

const SAMPLE_MD = `# Tên chủ đề / bài học

## Nội dung chính

Viết nội dung học tập ở đây. Có thể dùng **in đậm** cho thuật ngữ quan trọng, *in nghiêng* để nhấn mạnh, và \`code inline\` cho cú pháp.

### Công thức / Định nghĩa

Định nghĩa hoặc công thức quan trọng.

### Ví dụ

Ví dụ minh họa kèm giải thích.

## Hình ảnh minh họa

![mô tả ảnh](images/so-do.png)

## Câu hỏi ôn tập

\`\`\`quiz
{
  "question": "Câu hỏi trắc nghiệm kiểm tra kiến thức?",
  "options": [
    "Đáp án A",
    "Đáp án B (đúng)",
    "Đáp án C",
    "Đáp án D"
  ],
  "correct": 1,
  "explain": "Giải thích chi tiết tại sao B là đáp án đúng"
}
\`\`\`

\`\`\`quiz
{
  "type": "truefalse",
  "question": "Nhận định: Mặt Trời mọc ở hướng Tây?",
  "options": ["Đúng", "Sai"],
  "correct": 1,
  "explain": "Mặt Trời mọc ở hướng Đông, lặn ở hướng Tây"
}
\`\`\`
`

const AI_PROMPT = `Bạn là AI hỗ trợ tạo tài liệu học tập. Hãy tạo nội dung theo đúng định dạng dưới đây.

## Cấu trúc thư mục

- Mỗi chủ đề là một thư mục riêng
- Tên thư mục / file: tiếng Việt không dấu, dùng underscore thay khoảng trắng
- Mỗi file .md là một bài học nhỏ
- Ví dụ: On_Thi_Dai_Hoc/chuong-1/bai-1.md

## Định dạng Quiz

Dùng fenced code block với lang="quiz":

\\\`\\\`\\\`quiz
{
  "question": "Câu hỏi trắc nghiệm?",
  "options": ["A", "B", "C", "D"],
  "correct": 1,
  "explain": "Giải thích tại sao đáp án đúng"
}
\\\`\\\`\\\`

Cho câu hỏi đúng / sai:

\\\`\\\`\\\`quiz
{
  "type": "truefalse",
  "question": "Nhận định: ...?",
  "options": ["Đúng", "Sai"],
  "correct": 0
}
\\\`\\\`\\\`

### Các field trong quiz JSON

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| type | Không | "truefalse" nếu là đúng/sai; mặc định multiple choice |
| question | Có | Nội dung câu hỏi |
| options | Có | Mảng các đáp án |
| correct | Có | Index của đáp án đúng (0-based) |
| explain | Không | Giải thích sau khi trả lời |

## Hình ảnh

- Đặt ảnh trong thư mục images/ hoặc thư mục con cạnh file .md
- Dùng Markdown: ![mô tả](images/ten-file.png)
- Định dạng hỗ trợ: png, jpg, gif, svg, webp

## Yêu cầu

1. Mỗi bài học gồm: tiêu đề → nội dung chính (khái niệm, công thức, ví dụ) → quiz cuối bài
2. Nội dung viết bằng tiếng Việt
3. Quiz kiểm tra kiến thức trọng tâm, có giải thích đầy đủ
4. Dùng **bold** cho thuật ngữ, *italic* cho nhấn mạnh
5. Độ dài mỗi bài: 200-500 từ, đủ để đọc trong 5-10 phút`

const COPY_OK = '✅ Đã sao chép!'
const COPY_FAIL = '❌ Sao chép thất bại'

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
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
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
      const files = await extractArchive(file)

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
    } catch (e) {
      alert(`Không thể giải nén: ${(e instanceof Error ? e.message : 'File có thể bị lỗi')}`)
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

  const downloadSample = useCallback(() => {
    const blob = new Blob([SAMPLE_MD], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bai-hoc-mau.md'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT)
      setCopyMsg(COPY_OK)
    } catch {
      setCopyMsg(COPY_FAIL)
    }
    setTimeout(() => setCopyMsg(null), 2500)
  }, [])

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
      <div className="home-header">
        <h1 className="home-title">lazydoc</h1>
        <p className="home-subtitle">Học với Markdown + Quiz tương tác</p>
      </div>

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
            accept=".zip,.7z,.gz,.gzip"
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

        <hr className="guide-divider" />

        <div className="guide-ai">
          <h4 className="guide-subtitle">🤖 Dành cho AI</h4>
          <p className="ai-desc">
            File mẫu và prompt hướng dẫn để AI sinh tài liệu học tập đúng định dạng.
          </p>
          <div className="ai-actions">
            <button className="ai-btn" onClick={downloadSample}>
              <span className="ai-btn-icon">📥</span>
              <span>Tải file mẫu</span>
            </button>
            <button className="ai-btn" onClick={copyPrompt}>
              <span className="ai-btn-icon">📋</span>
              <span>Sao chép prompt</span>
            </button>
          </div>
          {copyMsg && <p className="ai-copy-msg">{copyMsg}</p>}
        </div>
      </div>
    </div>
  )
}
