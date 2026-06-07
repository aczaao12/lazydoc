import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, FileDown, Upload, Trash2, Eye, Code2, Clipboard } from 'lucide-react'
import { exportWordWithMath, hasLatex, copyToWordHtml } from '@/lib/export-math'

const FONT_OPTIONS = [
  'Times New Roman',
  'Arial',
  'Tahoma',
  'Calibri',
  'Cambria',
]

export default function ConvertPage() {
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [font, setFont] = useState(FONT_OPTIONS[0])
  const [enableLatex, setEnableLatex] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      setContent(text)
      setFileName(file.name)
    } catch {
      alert('Không thể đọc file')
    }
  }, [])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const handleDropZone = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt'))) {
      await handleFile(file)
    }
  }, [handleFile])

  const handleExport = useCallback(async () => {
    if (!content.trim()) return
    setProcessing(true)
    try {
      const title = fileName || 'ai-to-word'
      await exportWordWithMath(content, title, { font })
    } catch (err) {
      alert(`Lỗi khi xuất Word: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`)
    }
    setProcessing(false)
  }, [content, fileName, font])

  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  const handleCopyToWord = useCallback(async () => {
    if (!content.trim()) return
    try {
      const html = copyToWordHtml(content, font, enableLatex)
      const htmlBlob = new Blob([html], { type: 'text/html' })
      const plainBlob = new Blob([content], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob }),
      ])
      setCopyMsg('Đã copy!')
    } catch (err) {
      setCopyMsg('Copy thất bại')
    }
    setTimeout(() => setCopyMsg(null), 2500)
  }, [content, font, enableLatex])

  const clearAll = useCallback(() => {
    setContent('')
    setFileName(null)
  }, [])

  const hasFormula = enableLatex && hasLatex(content)
  const lineCount = content.split('\n').length

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-4 h-14 border-b bg-background">
        <div className="flex items-center gap-2">
          <span className="font-bold">lazydoc</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            AI → Word
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-1 size-4" />
            Trang chủ
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <FileDown className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI → Word</span>
          <span className="text-xs text-muted-foreground">
            Chuyển đổi Markdown (có công thức LaTeX) sang Word
          </span>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-0">
          {/* Input panel */}
          <div className="flex-1 flex flex-col min-h-0 border-r">
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <Code2 className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Nhập nội dung</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {lineCount} dòng
                </span>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => fileRef.current?.click()} title="Tải file .md">
                  <Upload className="size-3.5" />
                </Button>
                <input ref={fileRef} type="file" accept=".md,.markdown,.txt" hidden onChange={handleFileInput} />
                <Button variant="ghost" size="icon" className="size-6" onClick={clearAll} title="Xóa">
                  <Trash2 className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setShowPreview(p => !p)} title="Xem trước">
                  <Eye className="size-3.5" />
                </Button>
              </div>
            </div>
            <textarea
              className="flex-1 resize-none p-4 font-mono text-sm leading-relaxed outline-none bg-background"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropZone}
              placeholder={`Paste nội dung Markdown từ AI vào đây...

Ví dụ:
## Công thức

Phương trình bậc hai: $ax^2 + bx + c = 0$

Nghiệm: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Hoá học: $H_2O$, $CO_2$, $CH_4$

Vật lý: $E = mc^2$, $F = G\\frac{m_1 m_2}{r^2}$`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center px-3 py-1.5 border-b bg-muted/20">
                <Eye className="size-3.5 text-muted-foreground mr-2" />
                <span className="text-xs font-medium">Xem trước</span>
                {fileName && (
                  <span className="text-[10px] text-muted-foreground ml-2 bg-muted px-1.5 py-0.5 rounded">
                    {fileName}
                  </span>
                )}
              </div>
              <ScrollArea className="flex-1">
                {content ? (
                  <div className="p-6 max-w-3xl mx-auto prose prose-sm dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
                    <div>
                      <Eye className="mx-auto size-8 mb-2 opacity-40" />
                      <p>Nội dung xem trước sẽ hiển thị ở đây</p>
                      <p className="text-xs mt-1">Kéo thả file .md vào khung nhập liệu</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Options bar */}
        <div className="shrink-0 border-t bg-background px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 max-w-4xl mx-auto">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={enableLatex}
                onChange={(e) => setEnableLatex(e.target.checked)}
                className="rounded"
              />
              Xử lý công thức LaTeX ($...$, $$...$$)
              {hasFormula && (
                <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded">
                  Phát hiện công thức
                </span>
              )}
            </label>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Font:</span>
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCopyToWord}
                disabled={!content.trim()}
                className="gap-2"
              >
                <Clipboard className="size-4" />
                Copy to Word
                {copyMsg && (
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                    {copyMsg}
                  </span>
                )}
              </Button>

              <Button
                onClick={handleExport}
                disabled={!content.trim() || processing}
                className="gap-2"
              >
                {processing ? (
                  <span>Đang xử lý...</span>
                ) : (
                  <>
                    <FileDown className="size-4" />
                    Xuất Word (.docx)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
