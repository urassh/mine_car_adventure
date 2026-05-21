import { GameController } from './GameController'

export class KeyboardInput {
  private readonly controller: GameController
  private attached = false

  constructor(controller: GameController) {
    this.controller = controller
  }

  attach() {
    if (this.attached) return
    window.addEventListener('keydown', this.onKeyDown)
    this.attached = true
  }

  detach() {
    if (!this.attached) return
    window.removeEventListener('keydown', this.onKeyDown)
    this.attached = false
  }

  // 矢印キー/Space はブラウザの既定動作 (スクロール) を奪うため preventDefault が必要。
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.controller.setTilt(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.controller.setTilt(-1)
    } else if (e.code === 'Space') {
      e.preventDefault()
      this.controller.requestSpawnBranch()
    }
  }
}
