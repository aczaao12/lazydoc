import { useState, useEffect, useCallback } from 'react'
import type { MdFileEntry } from '../types'

interface TreeNode {
  name: string
  type: 'file' | 'folder'
  path: string
  children: TreeNode[]
}

interface Props {
  files: MdFileEntry[]
  selectedFile: string | null
  onSelect: (path: string) => void
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const path of paths) {
    const parts = path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (isLast) {
        current.push({ name: part, type: 'file', path, children: [] })
      } else {
        const prefix = parts.slice(0, i + 1).join('/')
        let folder = current.find(n => n.name === part && n.type === 'folder')
        if (!folder) {
          folder = { name: part, type: 'folder', path: prefix, children: [] }
          current.push(folder)
        }
        current = folder.children
      }
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.type === 'folder') sortNodes(n.children)
    }
  }
  sortNodes(root)

  return root
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'md') return '📝'
  if (IMAGE_EXTS.has(ext)) return '🖼️'
  return '📄'
}

function getParentFolders(path: string): string[] {
  const parts = path.split('/')
  const folders: string[] = []
  for (let i = 0; i < parts.length - 1; i++) {
    folders.push(parts.slice(0, i + 1).join('/'))
  }
  return folders
}

export default function FileSidebar({ files, selectedFile, onSelect }: Props) {
  const paths = files.map(f => f.path)
  const tree = buildTree(paths)

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (selectedFile) return new Set(getParentFolders(selectedFile))
    return new Set()
  })

  useEffect(() => {
    if (!selectedFile) return
    setExpanded(prev => {
      const next = new Set(prev)
      for (const folder of getParentFolders(selectedFile)) {
        next.add(folder)
      }
      return next
    })
  }, [selectedFile])

  const toggle = useCallback((folderPath: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(folderPath)) next.delete(folderPath)
      else next.add(folderPath)
      return next
    })
  }, [])

  const isExpanded = (folderPath: string) => expanded.has(folderPath)

  function renderTree(nodes: TreeNode[], depth: number) {
    return (
      <ul className="tree-list">
        {nodes.map(node => (
          <li key={node.path || node.name}>
            {node.type === 'folder' ? (
              <>
                <button
                  className="tree-folder"
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                  onClick={() => toggle(node.path)}
                >
                  <span className="tree-arrow">{isExpanded(node.path) ? '▼' : '▶'}</span>
                  <span className="tree-icon">{isExpanded(node.path) ? '📂' : '📁'}</span>
                  <span className="tree-folder-name">{node.name}</span>
                </button>
                {isExpanded(node.path) && renderTree(node.children, depth + 1)}
              </>
            ) : (
              <button
                className={`tree-file${node.path === selectedFile ? ' active' : ''}`}
                style={{ paddingLeft: `${8 + depth * 16}px` }}
                  onClick={() => onSelect(node.path)}
              >
                  <span className="tree-icon">{getFileIcon(node.name)}</span>
                {node.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <aside className="file-sidebar">
      <div className="sidebar-header">Bài học</div>
      {files.length === 0 ? (
        <p className="sidebar-empty">Không tìm thấy file .md</p>
      ) : (
        renderTree(tree, 0)
      )}
    </aside>
  )
}
