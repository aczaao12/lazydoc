export interface QuizData {
  type?: 'multiple' | 'truefalse'
  question: string
  options: string[]
  correct: number
  explain?: string
}

export interface FileInfo {
  name: string
  lastModified: number
}
