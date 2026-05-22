import {
  BRANCH_DESPAWN_Z,
  BRANCH_OFFSET,
  BRANCH_SPAWN_Z,
  BRANCH_TRAVERSE,
  FORWARD_SPEED,
} from '../core/constants'
import type { QuizQuestion } from '../quiz/QuizData'
import type { WorldRenderer } from '../render/WorldRenderer'
import type { QuizView } from '../ui/QuizView'

export type QuizState = 'Idle' | 'Selecting' | 'Answering' | 'Resolved'
export type AnsweredDirection = 'left' | 'right' | 'none'
export type BranchSide = 1 | -1

export interface BranchState {
  readonly side: BranchSide
  z: number
}

export interface QuizResult {
  question: QuizQuestion
  answeredDirection: AnsweredDirection
  isCorrect: boolean
}

const TILT_ANGLE = 0.25

const IDLE_DURATION = 1.5
const SELECTING_DURATION = 10
const COUNTDOWN_THRESHOLD = 5
const RESOLVED_DURATION = 4.5

const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export class PlayController {
  lateral = 0
  baseLateral = 0
  branch: BranchState | null = null

  quizState: QuizState = 'Idle'
  questionIndex = 0
  correctCount = 0
  answeredCount = 0
  lastResult: QuizResult | null = null

  private readonly world: WorldRenderer
  private readonly view: QuizView

  private tilt: -1 | 0 | 1 = 0

  private questions: QuizQuestion[] = []
  private stateElapsed = 0
  private baseLateralAtSelectingStart = 0
  private prevBranchActive = false

  constructor(world: WorldRenderer, view: QuizView) {
    this.world = world
    this.view = view
  }

  setQuestions(questions: QuizQuestion[]): void {
    this.questions = questions
    this.questionIndex = 0
  }

  setTilt(side: -1 | 0 | 1): void {
    this.tilt = side
    this.world.player.tilt(-side * TILT_ANGLE)
  }

  requestSpawnBranch(): void {
    if (this.branch) return
    if (this.tilt === 0) return
    this.branch = { side: this.tilt, z: BRANCH_SPAWN_Z }
  }

  get currentQuestion(): QuizQuestion | null {
    return this.questions[this.questionIndex] ?? null
  }

  get selectingTimeLeft(): number {
    if (this.quizState !== 'Selecting') return 0
    return Math.max(0, SELECTING_DURATION - this.stateElapsed)
  }

  get countdownDigit(): number | null {
    if (this.quizState !== 'Selecting') return null
    const left = this.selectingTimeLeft
    if (left > COUNTDOWN_THRESHOLD) return null
    return Math.max(1, Math.ceil(left))
  }

  update(dt: number): void {
    this.advanceQuiz(dt)
    this.advanceBranch(dt)
    this.driveWorld()
    this.driveView()
  }

  private advanceQuiz(dt: number): void {
    this.stateElapsed += dt
    switch (this.quizState) {
      case 'Idle':
        if (this.stateElapsed >= IDLE_DURATION && this.currentQuestion) {
          this.enterSelecting()
        }
        break
      case 'Selecting':
        if (this.branch !== null) {
          this.transition('Answering')
          break
        }
        if (this.stateElapsed >= SELECTING_DURATION) {
          this.requestSpawnBranch()
          if (this.branch) {
            this.transition('Answering')
          } else {
            this.recordResult('none')
            this.transition('Resolved')
          }
        }
        break
      case 'Answering':
        if (this.branch === null) {
          const delta = this.baseLateral - this.baseLateralAtSelectingStart
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

  private advanceBranch(dt: number): void {
    const branch = this.branch
    if (!branch) {
      this.lateral = this.baseLateral
      return
    }
    branch.z += FORWARD_SPEED * dt
    if (branch.z >= 0) {
      const t = Math.min(branch.z / BRANCH_TRAVERSE, 1)
      this.lateral = this.baseLateral + branch.side * BRANCH_OFFSET * smoothstep(t)
    } else {
      this.lateral = this.baseLateral
    }
    if (branch.z > BRANCH_DESPAWN_Z) {
      this.baseLateral += branch.side * BRANCH_OFFSET
      this.lateral = this.baseLateral
      this.branch = null
      this.tilt = 0
      this.world.player.resetOrientation()
    }
  }

  private driveWorld(): void {
    const branchActive = this.branch !== null
    if (branchActive && !this.prevBranchActive && this.branch) {
      this.world.pushBranch(this.branch.side, this.baseLateral)
    }
    this.prevBranchActive = branchActive

    this.world.player.setLateral(this.lateral)
  }

  private driveView(): void {
    const v = this.view
    v.renderScore(this.correctCount, this.answeredCount)
    v.hiddenQuiz()

    switch (this.quizState) {
      case 'Idle':
        return
      case 'Selecting':
      case 'Answering': {
        const cq = this.currentQuestion
        if (cq) {
          v.renderQuestionBoard(cq.question)
          v.renderLeftChoice(cq.choices.find((c) => c.direction === 'left')?.label ?? '')
          v.renderRightChoice(cq.choices.find((c) => c.direction === 'right')?.label ?? '')
        }
        if (this.countdownDigit !== null) {
          v.renderCountDown(this.countdownDigit)
        }
        if (this.quizState === 'Answering' && this.branch) {
          v.setChosenSide(this.branch.side === 1 ? 'right' : 'left')
        }
        return
      }
      case 'Resolved': {
        const r = this.lastResult
        if (!r) return
        if (r.answeredDirection === 'none') v.renderNone(r.question.explanation)
        else if (r.isCorrect) v.renderCorrect(r.question.explanation)
        else v.renderWrong(r.question.explanation)
        return
      }
    }
  }

  private enterSelecting(): void {
    this.baseLateralAtSelectingStart = this.baseLateral
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
    this.questionIndex = (this.questionIndex + 1) % this.questions.length
  }

  private transition(next: QuizState): void {
    console.log(`[Play] ${this.quizState} → ${next} (elapsed=${this.stateElapsed.toFixed(2)}s)`)
    this.quizState = next
    this.stateElapsed = 0
  }
}
