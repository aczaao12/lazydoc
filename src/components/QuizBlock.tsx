import { useState } from 'react'
import type { QuizData } from '../types'

export default function QuizBlock({ data }: { data: QuizData }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = selected === data.correct

  const getOptionClass = (i: number) => {
    if (!submitted) {
      return selected === i ? 'option selected' : 'option'
    }
    if (i === data.correct) return 'option correct'
    if (i === selected && !isCorrect) return 'option wrong'
    return 'option'
  }

  return (
    <div className="quiz-block">
      <p className="quiz-question">{data.question}</p>
      <div className="quiz-options">
        {data.options.map((opt, i) => (
          <button
            key={i}
            className={getOptionClass(i)}
            disabled={submitted}
            onClick={() => setSelected(i)}
          >
            <span className="option-letter">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]}</span>
            {opt}
          </button>
        ))}
      </div>
      {selected !== null && !submitted && (
        <button className="quiz-submit" onClick={() => setSubmitted(true)}>
          Kiểm tra
        </button>
      )}
      {submitted && (
        <p className={`quiz-result ${isCorrect ? 'correct-text' : 'wrong-text'}`}>
          {isCorrect ? 'Đúng!' : 'Sai!'}
        </p>
      )}
      {submitted && data.explain && (
        <p className="quiz-explain">{data.explain}</p>
      )}
    </div>
  )
}
