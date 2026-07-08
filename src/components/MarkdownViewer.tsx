import { useState, useEffect, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import QuizBlock from './QuizBlock'
import type { QuizData } from '../types'
import { preprocessMarkdownForMath } from '../lib/export-math'
import katex from 'katex'

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
    return () => { cancelled = true }
  }, [src, mdPathProp, resolveImage])

  if (error) return <p className="text-sm text-destructive bg-destructive/10 rounded p-2">Không tải được ảnh: {src}</p>
  if (!blobUrl) return <p className="text-sm text-muted-foreground italic">Đang tải ảnh...</p>
  return <img src={blobUrl} alt={alt} className="rounded max-w-full h-auto my-2" />
}

interface Props {
  content: string
  mdPath?: string
  resolveImage?: (mdPath: string, src: string) => Promise<string | null>
}

const MarkdownViewer = memo(function MarkdownViewer({ content, mdPath = '', resolveImage }: Props) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-img:rounded prose-a:text-blue-600">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt }) {
            if (resolveImage && src) {
              return (
                <ImageResolver src={src} alt={alt || ''} resolveImage={resolveImage} mdPath={mdPath} />
              )
            }
            return <img src={src} alt={alt || ''} />
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto">
                <table {...props} className="border-collapse border border-border">{children}</table>
              </div>
            )
          },
          code({ className, children, ...props }: CodeProps) {
            const text = String(children);
            if (text.startsWith('math-inline:')) {
              const latex = text.slice(12);
              try {
                const html = katex.renderToString(latex, { displayMode: false, throwOnError: false });
                return <span dangerouslySetInnerHTML={{ __html: html }} />;
              } catch {
                return <code {...props}>{latex}</code>;
              }
            }
            if (className === 'language-math-display') {
              const latex = text.trim();
              try {
                const html = katex.renderToString(latex, { displayMode: true, throwOnError: false });
                return <div className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
              } catch {
                return <pre className="my-4 overflow-x-auto"><code>{latex}</code></pre>;
              }
            }
            if (className === 'language-quiz') {
              try {
                const data: QuizData = JSON.parse(text.trim())
                return <QuizBlock data={data} />
              } catch {
                return <p className="text-destructive bg-destructive/10 rounded p-3">Lỗi định dạng quiz JSON</p>
              }
            }
            return <code className={className} {...props}>{children}</code>
          },
        }}
      >
        {preprocessMarkdownForMath(content)}
      </ReactMarkdown>
    </div>
  )
})

export default MarkdownViewer
