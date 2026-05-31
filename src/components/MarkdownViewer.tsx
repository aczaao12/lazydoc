import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import QuizBlock from './QuizBlock'
import type { QuizData } from '../types'

interface CodeProps {
  className?: string
  children?: React.ReactNode
}

function ImageResolver({
  src,
  alt,
  resolveImage,
  mdPath: mdPathProp,
}: {
  src: string
  alt: string
  resolveImage: (mdPath: string, src: string) => Promise<string | null>
  mdPath: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setBlobUrl(null)
    setError(false)

    resolveImage(mdPathProp, src).then((url) => {
      if (cancelled) return
      if (url) setBlobUrl(url)
      else setError(true)
    })

    return () => {
      cancelled = true
    }
  }, [src, mdPathProp, resolveImage])

  if (error) return <p className="img-error">Không tải được ảnh: {src}</p>
  if (!blobUrl) return <p className="img-loading">Đang tải ảnh...</p>
  return <img src={blobUrl} alt={alt} />
}

interface Props {
  content: string
  mdPath?: string
  resolveImage?: (mdPath: string, src: string) => Promise<string | null>
}

export default function MarkdownViewer({ content, mdPath = '', resolveImage }: Props) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt }) {
            if (resolveImage && src) {
              return (
                <ImageResolver
                  src={src}
                  alt={alt || ''}
                  resolveImage={resolveImage}
                  mdPath={mdPath}
                />
              )
            }
            return <img src={src} alt={alt || ''} />
          },
          code({ className, children, ...props }: CodeProps) {
            if (className === 'language-quiz') {
              try {
                const data: QuizData = JSON.parse(String(children).trim())
                return <QuizBlock data={data} />
              } catch {
                return <p className="quiz-error">Lỗi định dạng quiz JSON</p>
              }
            }
            return <code className={className} {...props}>{children}</code>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
