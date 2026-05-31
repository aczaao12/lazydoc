import { useRef, type DragEvent } from 'react'

interface Props {
  onFileLoad: (content: string, fileName: string) => void
}

export default function FileExplorer({ onFileLoad }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File) => {
    if (!file.name.endsWith('.md')) return
    const reader = new FileReader()
    reader.onload = () => {
      onFileLoad(reader.result as string, file.name)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  return (
    <div
      className="file-explorer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".md"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
        }}
      />
      <div className="file-explorer-content">
        <span className="file-icon">📂</span>
        <p className="file-prompt">Nhấn để chọn file <code>.md</code></p>
        <p className="file-hint">hoặc kéo thả file vào đây</p>
      </div>
    </div>
  )
}
