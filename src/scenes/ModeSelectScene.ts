import {
  BRANCH_DESPAWN_Z,
  BRANCH_OFFSET,
  BRANCH_SPAWN_Z,
  BRANCH_TRAVERSE,
  FORWARD_SPEED,
} from '../views/render/constants'
import { WorldRenderer } from '../views/render/WorldRenderer'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { Scene } from './Scene'

type Side = 1 | -1
interface Branch {
  readonly side: Side
  z: number
}

const TILT_ANGLE = 0.25
const POST_BRANCH_DELAY_MS = 1000
const QUESTION_TEXT = 'モードを選んでください'
const LEFT_LABEL = 'シングルモード'
const RIGHT_LABEL = 'マルチモード'

const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export type GameMode = 'single' | 'multi'

export class ModeSelectScene extends Scene {
  private world!: WorldRenderer
  private navigator: NextSceneNavigator | null = null
  private chosen: GameMode | null = null

  get chosenMode(): GameMode | null {
    return this.chosen
  }

  private questionOverlay: HTMLDivElement | null = null
  private choicesOverlay: HTMLDivElement | null = null
  private leftChoice: HTMLDivElement | null = null
  private rightChoice: HTMLDivElement | null = null
  private leftLabel: HTMLDivElement | null = null
  private rightLabel: HTMLDivElement | null = null
  private hintOverlay: HTMLDivElement | null = null

  private tilt: -1 | 0 | 1 = 0
  private baseLateral = 0
  private lateral = 0
  private branch: Branch | null = null
  private prevBranchActive = false
  private transitionTimer: number | null = null
  private transitioned = false

  mount(navigator: NextSceneNavigator): void {
    this.navigator = navigator

    const app = document.querySelector<HTMLDivElement>('#app')!
    this.world = new WorldRenderer(app)

    this.questionOverlay = document.querySelector<HTMLDivElement>('#question-overlay')
    this.choicesOverlay = document.querySelector<HTMLDivElement>('#choices-overlay')
    this.leftChoice = document.querySelector<HTMLDivElement>('.choice[data-direction="left"]')
    this.rightChoice = document.querySelector<HTMLDivElement>('.choice[data-direction="right"]')
    this.leftLabel = document.querySelector<HTMLDivElement>(
      '.choice[data-direction="left"] .choice-label',
    )
    this.rightLabel = document.querySelector<HTMLDivElement>(
      '.choice[data-direction="right"] .choice-label',
    )
    this.hintOverlay = document.querySelector<HTMLDivElement>('#mode-hint')

    if (this.questionOverlay) {
      this.questionOverlay.textContent = QUESTION_TEXT
      this.questionOverlay.classList.remove('hidden')
    }
    if (this.leftLabel) {
      this.leftLabel.textContent = LEFT_LABEL
      this.leftLabel.style.backgroundImage = ''
    }
    if (this.rightLabel) {
      this.rightLabel.textContent = RIGHT_LABEL
      this.rightLabel.style.backgroundImage = ''
    }
    this.choicesOverlay?.classList.remove('hidden')
    this.hintOverlay?.classList.remove('hidden')
    this.setChosen(null)

    window.addEventListener('keydown', this.onKey)
  }

  unmount(): void {
    window.removeEventListener('keydown', this.onKey)
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer)
      this.transitionTimer = null
    }
    this.questionOverlay?.classList.add('hidden')
    if (this.questionOverlay) this.questionOverlay.textContent = ''
    this.choicesOverlay?.classList.add('hidden')
    this.hintOverlay?.classList.add('hidden')
    this.setChosen(null)
    this.world.dispose()
    this.navigator = null
  }

  update(dt: number, time: number): void {
    if (this.transitioned) return
    this.advanceBranch(dt)
    this.driveWorld()
    this.world.player.setLateral(this.lateral)
    this.world.player.update(dt, time)
    this.world.update(dt)
  }

  render(): void {
    if (this.transitioned) return
    this.world.render()
  }

  resize(): void {
    this.world.resize()
  }

  private advanceBranch(dt: number): void {
    const b = this.branch
    if (!b) {
      this.lateral = this.baseLateral
      return
    }
    b.z += FORWARD_SPEED * dt
    if (b.z >= 0) {
      const t = Math.min(b.z / BRANCH_TRAVERSE, 1)
      this.lateral = this.baseLateral + b.side * BRANCH_OFFSET * smoothstep(t)
    } else {
      this.lateral = this.baseLateral
    }
    if (b.z > BRANCH_DESPAWN_Z) {
      this.baseLateral += b.side * BRANCH_OFFSET
      this.lateral = this.baseLateral
      this.branch = null
      this.tilt = 0
      this.world.player.resetOrientation()
      this.scheduleTransition()
    }
  }

  private driveWorld(): void {
    const active = this.branch !== null
    if (active && !this.prevBranchActive && this.branch) {
      this.world.pushBranch(this.branch.side, this.baseLateral)
    }
    this.prevBranchActive = active
  }

  private setTilt(side: -1 | 0 | 1): void {
    if (this.branch || this.transitionTimer !== null) return
    this.tilt = side
    this.world.player.tilt(-side * TILT_ANGLE)
  }

  private spawnBranch(): void {
    if (this.branch) return
    if (this.tilt === 0) return
    if (this.transitionTimer !== null) return
    this.branch = { side: this.tilt, z: BRANCH_SPAWN_Z }
    const side = this.tilt === 1 ? 'right' : 'left'
    this.chosen = side === 'right' ? 'multi' : 'single'
    this.setChosen(side)
    this.hintOverlay?.classList.add('hidden')
  }

  private scheduleTransition(): void {
    if (this.transitionTimer !== null) return
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null
      this.transitioned = true
      this.navigator?.navigate_next_scene()
    }, POST_BRANCH_DELAY_MS)
  }

  private setChosen(side: 'left' | 'right' | null): void {
    this.choicesOverlay?.classList.toggle('answering', side !== null)
    this.leftChoice?.classList.toggle('chosen', side === 'left')
    this.rightChoice?.classList.toggle('chosen', side === 'right')
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.setTilt(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.setTilt(-1)
    } else if (e.code === 'Space') {
      e.preventDefault()
      this.spawnBranch()
    }
  }
}
