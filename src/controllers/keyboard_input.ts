import type { PlayController } from './play_controller'

export class KeyboardInput {
  private readonly play: PlayController
  private attached = false

  constructor(play: PlayController) {
    this.play = play
  }

  attach(): void {
    if (this.attached) return
    window.addEventListener('keydown', this.onKeyDown)
    this.attached = true
  }

  detach(): void {
    if (!this.attached) return
    window.removeEventListener('keydown', this.onKeyDown)
    this.attached = false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.play.setTilt(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.play.setTilt(-1)
    } else if (e.code === 'Space') {
      e.preventDefault()
      this.play.requestSpawnBranch()
    }
  }
}
