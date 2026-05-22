import type { QuizQuestion } from './QuizData'

export type AnsweredDirection = 'left' | 'right' | 'none'

export interface QuizResult {
  question: QuizQuestion
  answeredDirection: AnsweredDirection
  isCorrect: boolean
}
