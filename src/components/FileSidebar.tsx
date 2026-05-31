import type { MdFileEntry } from '../types'

interface Props {
  files: MdFileEntry[]
  selectedFile: string | null
  onSelect: (path: string) => void
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
            <li key={file.path}>
              <button
                className={`sidebar-item ${file.path === selectedFile ? 'active' : ''}`}
                onClick={() => onSelect(file.path)}
              >
                {file.path}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
