export interface QuizData {
  type?: 'multiple' | 'truefalse'
  question: string
  options: string[]
  correct: number
  explain?: string
}

export interface MdFileEntry {
  path: string
  lastModified: number
}
