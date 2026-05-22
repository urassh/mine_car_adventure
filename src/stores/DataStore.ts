import type { QuizQuestion } from '../quiz/QuizData'
import type { QuizResult } from '../quiz/QuizResult'

const QUESTIONS_KEY = 'quiz.questions'
const RESULTS_KEY = 'quiz.results'

export class DataStore {
  private readonly storage: Storage
  private questions: QuizQuestion[] = []
  private results: QuizResult[] = []

  constructor(storage: Storage = sessionStorage) {
    this.storage = storage
    this.questions = this.read<QuizQuestion[]>(QUESTIONS_KEY) ?? []
    this.results = this.read<QuizResult[]>(RESULTS_KEY) ?? []
  }

  setQuestions(questions: QuizQuestion[]): void {
    this.questions = questions
    this.write(QUESTIONS_KEY, questions)
  }

  getQuestions(): readonly QuizQuestion[] {
    return this.questions
  }

  questionAt(index: number): QuizQuestion | null {
    return this.questions[index] ?? null
  }

  get questionCount(): number {
    return this.questions.length
  }

  addResult(result: QuizResult): void {
    this.results.push(result)
    this.write(RESULTS_KEY, this.results)
  }

  getResults(): readonly QuizResult[] {
    return this.results
  }

  get lastResult(): QuizResult | null {
    return this.results[this.results.length - 1] ?? null
  }

  get answeredCount(): number {
    return this.results.length
  }

  get correctCount(): number {
    let n = 0
    for (const r of this.results) if (r.isCorrect) n += 1
    return n
  }

  clearResults(): void {
    this.results = []
    this.storage.removeItem(RESULTS_KEY)
  }

  clear(): void {
    this.questions = []
    this.results = []
    this.storage.removeItem(QUESTIONS_KEY)
    this.storage.removeItem(RESULTS_KEY)
  }

  private read<T>(key: string): T | null {
    const raw = this.storage.getItem(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value))
  }
}
