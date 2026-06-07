import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { QuizData } from '../types'

export default function QuizBlock({ data }: { data: QuizData }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (!data || !Array.isArray(data.options) || typeof data.correct !== 'number') {
    return <p className="text-destructive bg-destructive/10 rounded p-3">Dữ liệu quiz không hợp lệ</p>
  }

  const options = data.type === 'truefalse' && data.options.length === 0
    ? ['Đúng', 'Sai']
    : data.options

  const isCorrect = selected === data.correct

  const handleRetry = () => { setSelected(null); setSubmitted(false) }

  const letter = (i: number) => i < 26 ? String.fromCharCode(65 + i) : '?'

  return (
    <div className="border-2 border-foreground rounded-xl p-5 my-6 bg-card shadow-[4px_4px_0_#1a1a1a]">
      <p className="font-semibold mb-4">{data.question}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          let optionClass = 'border-input bg-background hover:border-muted-foreground hover:bg-accent'
          if (submitted && i === data.correct) optionClass = 'border-green-600 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
          else if (submitted && i === selected && !isCorrect) optionClass = 'border-destructive bg-destructive/10 text-destructive'

          return (
            <button
              key={i}
              type="button"
              disabled={submitted}
              className={cn(
                'flex items-center gap-2 w-full text-left px-4 py-2.5 border-2 rounded-lg text-sm transition-all',
                selected === i && !submitted ? 'border-foreground bg-accent' : '',
                submitted ? 'cursor-default' : 'cursor-pointer',
                optionClass,
              )}
              onClick={() => setSelected(i)}
            >
              <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted text-xs font-bold shrink-0">
                {letter(i)}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
      {selected !== null && !submitted && (
        <Button className="mt-4" onClick={() => setSubmitted(true)}>Kiểm tra</Button>
      )}
      {submitted && (
        <>
          <p className={cn('mt-3 font-bold', isCorrect ? 'text-green-600' : 'text-destructive')}>
            {isCorrect ? 'Đúng!' : 'Sai!'}
          </p>
          {!isCorrect && (
            <Button variant="outline" className="mt-2" onClick={handleRetry}>Thử lại</Button>
          )}
        </>
      )}
      {submitted && data.explain && (
        <p className="mt-2 text-sm text-muted-foreground italic">{data.explain}</p>
      )}
    </div>
  )
}
