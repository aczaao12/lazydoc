import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import FileSidebar from '../components/FileSidebar'
import MarkdownViewer from '../components/MarkdownViewer'
import { walkMdFiles, readFileText, readFileBlob } from '../lib/folder'
import { readArchiveText, listMdFromArchive, readArchiveBlob, extractArchive } from '../lib/archive'
import { resolveRelativePath } from '../lib/path'
import { exportPdf, exportWord } from '../lib/export'
import { getFolderEntries, removeFolderEntry, saveFolderHandle } from '../lib/db'
import { getArchiveEntries, removeArchiveEntry, saveArchive } from '../lib/db'
import type { MdFileEntry } from '../types'
import type { FolderEntry, ArchiveEntry, ArchiveFileEntry } from '../lib/db'
import { ArrowLeft, FileText, FolderOpen, Menu, Package } from 'lucide-react'

type Source =
  | { type: 'folder'; handle: FileSystemDirectoryHandle; name: string }
  | { type: 'archive'; name: string; files: Map<string, Uint8Array> }

interface RecentItem {
  id: string
  name: string
  type: 'folder' | 'archive'
  openedAt: number
}

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

function NoSourceView({
  onFolderOpen,
  onArchiveOpen,
  recentItems,
  onRestoreFolder,
  onRestoreArchive,
  onDeleteItem,
  onRefreshHistory,
}: {
  onFolderOpen: () => void
  onArchiveOpen: (e: React.ChangeEvent<HTMLInputElement>) => void
  recentItems: RecentItem[]
  onRestoreFolder: (entry: FolderEntry) => void
  onRestoreArchive: (entry: ArchiveEntry) => void
  onDeleteItem: (item: RecentItem) => void
  onRefreshHistory: () => void
}) {
  const supportsFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window
  const zipRef = useRef<HTMLInputElement>(null)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">Đọc tài liệu</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mở thư mục hoặc import file nén để duyệt tài liệu Markdown
        </p>
      </div>

      <div className="flex gap-3">
        {supportsFolder && (
          <Button onClick={onFolderOpen} className="gap-2 h-auto flex-col py-4 px-6">
            <FolderOpen className="size-6" />
            <span className="font-semibold">Mở thư mục</span>
            <span className="text-xs opacity-60 font-normal">Đồng bộ tự động</span>
          </Button>
        )}
        <Button variant="secondary" onClick={() => zipRef.current?.click()} className="gap-2 h-auto flex-col py-4 px-6">
          <Package className="size-6" />
          <span className="font-semibold">Import .zip</span>
          <span className="text-xs opacity-60 font-normal">Giải nén trong trình duyệt</span>
        </Button>
        <input ref={zipRef} type="file" accept=".zip,.7z,.gz,.gzip" hidden onChange={onArchiveOpen} />
      </div>

      {recentItems.length > 0 && (
        <Card className="w-full mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Gần đây</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1">
              {recentItems.map((item) => (
                <li key={`${item.type}-${item.id}`} className="flex items-center gap-2 group">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-start text-sm font-normal h-auto py-1.5"
                    onClick={() => {
                      if (item.type === 'folder') {
                        getFolderEntries().then((entries) => {
                          const found = entries.find((e) => e.id === item.id)
                          if (found) onRestoreFolder(found)
                          else onRefreshHistory()
                        })
                      } else {
                        getArchiveEntries().then((entries) => {
                          const found = entries.find((e) => e.id === item.id)
                          if (found) onRestoreArchive(found)
                          else onRefreshHistory()
                        })
                      }
                    }}
                  >
                    {item.type === 'folder' ? '📁' : '📦'} {item.name}
                  </Button>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.openedAt).toLocaleDateString('vi-VN', {
                      hour: '2-digit', minute: '2-digit',
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                  <button
                    className="text-muted-foreground/40 hover:text-destructive text-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDeleteItem(item)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Hướng dẫn</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm space-y-3">
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li><strong className="text-foreground">Mở thư mục</strong> — chọn thư mục chứa file <code>.md</code>, tự động đồng bộ</li>
            <li><strong className="text-foreground">Import .zip</strong> — kéo file zip vào hoặc chọn, giải nén trong browser</li>
            <li><strong className="text-foreground">Chọn bài học</strong> — click vào file từ danh sách bên trái</li>
            <li><strong className="text-foreground">Làm quiz</strong> — chọn đáp án, bấm "Kiểm tra"</li>
          </ol>
          <div className="bg-muted p-2 rounded text-xs text-muted-foreground">
            Ảnh trong file .md được resolve tự động (cùng thư mục hoặc thư mục con)
          </div>

          <p className="font-medium text-foreground">Định dạng quiz</p>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{'```\n{\n  "question": "...",\n  "options": ["A", "B", "C", "D"],\n  "correct": 2,\n  "explain": "..."\n}\n```'}
          </pre>

          <Separator />

          <div>
            <p className="font-medium text-foreground mb-1">🤖 Dành cho AI</p>
            <p className="text-xs text-muted-foreground mb-2">
              File mẫu và prompt hướng dẫn để AI sinh tài liệu học tập đúng định dạng.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadSample}>
                📥 Tải file mẫu
              </Button>
              <Button size="sm" variant="outline" onClick={copyPrompt}>
                📋 Sao chép prompt
              </Button>
            </div>
            {copyMsg && <p className="mt-2 text-xs font-semibold">{copyMsg}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ReaderPage() {
  const navigate = useNavigate()
  const [source, setSource] = useState<Source | null>(null)
  const [files, setFiles] = useState<MdFileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])

  const sourceRef = useRef(source)
  sourceRef.current = source
  const selectedRef = useRef(selectedFile)
  selectedRef.current = selectedFile

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const [folders, archives] = await Promise.all([
      getFolderEntries(),
      getArchiveEntries(),
    ])
    const recent: RecentItem[] = [
      ...folders.map((f) => ({ id: f.id, name: f.name, type: 'folder' as const, openedAt: f.openedAt })),
      ...archives.map((a) => ({ id: a.id, name: a.name, type: 'archive' as const, openedAt: a.importedAt })),
    ]
    recent.sort((a, b) => b.openedAt - a.openedAt)
    setRecentItems(recent)
  }

  const loadFile = useCallback(async (path: string) => {
    const s = sourceRef.current
    if (!s) return
    try {
      let content: string | null = null
      if (s.type === 'folder') content = await readFileText(s.handle, path)
      else content = readArchiveText(s.files, path)
      if (content !== null) { setSelectedFile(path); setFileContent(content) }
    } catch { /* ignore */ }
  }, [])

  const resolveImage = useCallback(async (mdPath: string, src: string): Promise<string | null> => {
    const s = sourceRef.current
    if (!s) return null
    const resolved = resolveRelativePath(mdPath, src)
    if (s.type === 'folder') {
      const blob = await readFileBlob(s.handle, resolved)
      return blob ? URL.createObjectURL(blob) : null
    }
    const blob = readArchiveBlob(s.files, resolved)
    return blob ? URL.createObjectURL(blob) : null
  }, [])

  const handleSelect = useCallback((path: string) => {
    loadFile(path)
    setSidebarOpen(false)
  }, [loadFile])

  async function openFolder() {
    if (!('showDirectoryPicker' in window)) return
    try {
      const handle = await window.showDirectoryPicker()
      await saveFolderHandle({ id: handle.name, name: handle.name, handle, openedAt: Date.now() })
      setSource({ type: 'folder', handle, name: handle.name })
      setFiles([]); setSelectedFile(null); setFileContent(null)
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') throw e
    }
  }

  async function handleArchiveOpen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const extracted = await extractArchive(file)
      const fileArr: ArchiveFileEntry[] = []
      for (const [path, data] of extracted) fileArr.push({ path, data: new Blob([data as BlobPart]) })
      await saveArchive({ id: file.name, name: file.name, files: fileArr, importedAt: Date.now() })
      setSource({ type: 'archive', name: file.name, files: extracted })
      setFiles([]); setSelectedFile(null); setFileContent(null)
    } catch (e) {
      alert(`Không thể giải nén: ${(e instanceof Error ? e.message : 'File có thể bị lỗi')}`)
    }
    e.target.value = ''
  }

  async function restoreFolder(entry: FolderEntry) {
    try {
      const perm = await entry.handle.queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        const result = await entry.handle.requestPermission({ mode: 'read' })
        if (result !== 'granted') return
      }
      await saveFolderHandle({ ...entry, openedAt: Date.now() })
      setSource({ type: 'folder', handle: entry.handle, name: entry.name })
      setFiles([]); setSelectedFile(null); setFileContent(null)
    } catch { await removeFolderEntry(entry.id); loadHistory() }
  }

  async function restoreArchive(entry: ArchiveEntry) {
    try {
      const map = new Map<string, Uint8Array>()
      for (const f of entry.files) {
        const buffer = await f.data.arrayBuffer()
        map.set(f.path, new Uint8Array(buffer))
      }
      await saveArchive({ ...entry, importedAt: Date.now() })
      setSource({ type: 'archive', name: entry.name, files: map })
      setFiles([]); setSelectedFile(null); setFileContent(null)
    } catch { await removeArchiveEntry(entry.id); loadHistory() }
  }

  async function deleteItem(item: RecentItem) {
    if (item.type === 'folder') await removeFolderEntry(item.id)
    else await removeArchiveEntry(item.id)
    loadHistory()
  }

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
        if (md.path === selName && mtimes.get(md.path) !== file.lastModified) selectedChanged = true
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

  useEffect(() => {
    if (!source || source.type !== 'archive') return
    const mdFiles = listMdFromArchive(source.files)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFiles(mdFiles.map((path) => ({ path, lastModified: 0 })))
  }, [source])

  if (!source) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b bg-background">
          <span className="font-bold">lazydoc</span>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-1 size-4" />
            Trang chủ
          </Button>
        </header>
        <div className="flex-1 flex flex-col items-center p-6 pt-12">
          <NoSourceView
            onFolderOpen={openFolder}
            onArchiveOpen={handleArchiveOpen}
            recentItems={recentItems}
            onRestoreFolder={restoreFolder}
            onRestoreArchive={restoreArchive}
            onDeleteItem={deleteItem}
            onRefreshHistory={loadHistory}
          />
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <FileSidebar files={files} selectedFile={selectedFile} onSelect={handleSelect} />
  )

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-4 h-14 border-b bg-background">
        <div className="flex items-center gap-2">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="text-sm">Bài học</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                {sidebarContent}
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <span className="font-bold">lazydoc</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {source.type === 'folder' ? '📁' : '📦'} {source.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {fileContent && (
            <>
              <Button variant="ghost" size="sm" onClick={() => exportWord(fileContent, selectedFile || 'document')}>
                <FileText className="size-4 mr-1" />
                Word
              </Button>
              <Button variant="ghost" size="sm" onClick={exportPdf}>
                PDF
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            Trang chủ
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:block w-60 shrink-0 border-r bg-card">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
            Bài học
          </div>
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            {sidebarContent}
          </ScrollArea>
        </aside>
        <main className="flex-1 overflow-y-auto">
          {fileContent ? (
            <div className="max-w-3xl mx-auto px-4 py-6">
              <MarkdownViewer content={fileContent} mdPath={selectedFile || ''} resolveImage={resolveImage} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <FileText className="mx-auto size-8 mb-2 opacity-40" />
                <p>Chọn một file .md từ danh sách bên trái</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
