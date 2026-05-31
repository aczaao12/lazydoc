import type { FileInfo } from '../types'

interface Props {
  files: FileInfo[]
  selectedFile: string | null
  onSelect: (name: string) => void
}

export default function FileSidebar({ files, selectedFile, onSelect }: Props) {
  return (
    <aside className="file-sidebar">
      <div className="sidebar-header">Bài học</div>
      {files.length === 0 ? (
        <p className="sidebar-empty">Không tìm thấy file .md</p>
      ) : (
        <ul className="sidebar-list">
          {files.map((file) => (
            <li key={file.name}>
              <button
                className={`sidebar-item ${file.name === selectedFile ? 'active' : ''}`}
                onClick={() => onSelect(file.name)}
              >
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
