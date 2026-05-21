import type { GameController } from '../controllers/GameController'
import type { QuizQuestion } from './QuizData'

// 出題サイクルの状態。THREE 非依存。
//   Idle       : 問題間の小休止
//   Selecting  : 10s の選択ウィンドウ。残り 5s でカウントダウンを表示
//   Answering  : 分岐に乗って通過中
//   Resolved   : 正誤と解説を表示
export type QuizState = 'Idle' | 'Selecting' | 'Answering' | 'Resolved'

const IDLE_DURATION = 1.5
const SELECTING_DURATION = 10
const COUNTDOWN_THRESHOLD = 5
const RESOLVED_DURATION = 4.5

export type AnsweredDirection = 'left' | 'right' | 'none'

export type QuizResult = {
  question: QuizQuestion
  answeredDirection: AnsweredDirection
  isCorrect: boolean
}

export class QuizController {
  state: QuizState = 'Idle'
  questionIndex = 0
  correctCount = 0
  answeredCount = 0
  lastResult: QuizResult | null = null

  private readonly game: GameController
  private questions: QuizQuestion[] = []
  private stateElapsed = 0
  // Selecting 開始時の baseLateral。Answering 終了時にこれと比較して左右を決める。
  private baseLateralAtSelectingStart = 0

  constructor(game: GameController) {
    this.game = game
  }

  setQuestions(questions: QuizQuestion[]): void {
    this.questions = questions
    this.questionIndex = 0
  }

  get currentQuestion(): QuizQuestion | null {
    return this.questions[this.questionIndex] ?? null
  }

  // Selecting 中の残り秒。それ以外の状態では 0。
  get selectingTimeLeft(): number {
    if (this.state !== 'Selecting') return 0
    return Math.max(0, SELECTING_DURATION - this.stateElapsed)
  }

  // 残り 5s 以下のときだけカウントダウンを出す。整数 (5,4,3,2,1) で返す。
  get countdownDigit(): number | null {
    if (this.state !== 'Selecting') return null
    const left = this.selectingTimeLeft
    if (left > COUNTDOWN_THRESHOLD) return null
    return Math.max(1, Math.ceil(left))
  }

  update(dt: number): void {
    this.stateElapsed += dt
    switch (this.state) {
      case 'Idle':
        if (this.stateElapsed >= IDLE_DURATION && this.currentQuestion) {
          this.enterSelecting()
        }
        break
      case 'Selecting':
        // 早押し (Space 等) で分岐が先に出たら即 Answering へ。
        if (this.game.branch !== null) {
          this.transition('Answering')
          break
        }
        if (this.stateElapsed >= SELECTING_DURATION) {
          // タイマー切れ。現在の tilt で強制的にスポーンを試行する。
          // tilt = 0 だった場合は no-op になるので 未回答扱いで直接 Resolved。
          this.game.requestSpawnBranch()
          if (this.game.branch) {
            this.transition('Answering')
          } else {
            this.recordResult('none')
            this.transition('Resolved')
          }
        }
        break
      case 'Answering':
        // 分岐通過完了。baseLateral が変化していれば左右を判定。
        if (this.game.branch === null) {
          const delta = this.game.baseLateral - this.baseLateralAtSelectingStart
          if (delta > 0) this.recordResult('right')
          else if (delta < 0) this.recordResult('left')
          else this.recordResult('none')
          this.transition('Resolved')
        }
        break
      case 'Resolved':
        if (this.stateElapsed >= RESOLVED_DURATION) {
          this.advanceQuestion()
          this.transition('Idle')
        }
        break
    }
  }

  private enterSelecting(): void {
    this.baseLateralAtSelectingStart = this.game.baseLateral
    this.transition('Selecting')
  }

  private recordResult(dir: AnsweredDirection): void {
    const q = this.currentQuestion
    if (!q) return
    const chosen = dir === 'none' ? undefined : q.choices.find((c) => c.direction === dir)
    const isCorrect = chosen?.isCorrect ?? false
    this.lastResult = { question: q, answeredDirection: dir, isCorrect }
    this.answeredCount += 1
    if (isCorrect) this.correctCount += 1
  }

  private advanceQuestion(): void {
    if (this.questions.length === 0) return
    // 全問終了したらループ。Step 9 でリザルト画面に差し替える想定。
    this.questionIndex = (this.questionIndex + 1) % this.questions.length
  }

  private transition(next: QuizState): void {
    console.log(`[Quiz] ${this.state} → ${next} (elapsed=${this.stateElapsed.toFixed(2)}s)`)
    this.state = next
    this.stateElapsed = 0
  }
}
