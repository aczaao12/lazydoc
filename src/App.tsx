import { useState } from 'react'
import FileExplorer from './components/FileExplorer'
import MarkdownViewer from './components/MarkdownViewer'
import './App.css'

export default function App() {
  const [file, setFile] = useState<{ content: string; name: string } | null>(null)

  if (!file) {
    return (
      <div className="app">
        <h1 className="app-title">lazydoc</h1>
        <FileExplorer onFileLoad={(content, name) => setFile({ content, name })} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={() => setFile(null)}>← Mở file khác</button>
        <span className="file-name">{file.name}</span>
      </header>
      <main className="markdown-container">
        <MarkdownViewer content={file.content} />
      </main>
    </div>
  )
}
