import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import QuizBlock from './QuizBlock'
import type { QuizData } from '../types'

interface CodeProps {
  className?: string
  children?: React.ReactNode
}

export default function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
