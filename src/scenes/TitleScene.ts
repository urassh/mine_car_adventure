import { WorldRenderer } from '../views/render/WorldRenderer'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { Scene } from './Scene'

export class TitleScene extends Scene {
  private world!: WorldRenderer
  private overlay: HTMLDivElement | null = null
  private startButton: HTMLButtonElement | null = null
  private navigator: NextSceneNavigator | null = null

  mount(navigator: NextSceneNavigator): void {
    this.navigator = navigator

    const app = document.querySelector<HTMLDivElement>('#app')!
    this.world = new WorldRenderer(app)

    this.overlay = document.querySelector<HTMLDivElement>('#title-overlay')
    this.startButton = this.overlay?.querySelector<HTMLButtonElement>('.title-start') ?? null
    this.overlay?.classList.remove('hidden')
    this.startButton?.addEventListener('click', this.onStart)
    window.addEventListener('keydown', this.onKey)
  }

  unmount(): void {
    this.startButton?.removeEventListener('click', this.onStart)
    window.removeEventListener('keydown', this.onKey)
    this.overlay?.classList.add('hidden')
    this.world.dispose()
    this.navigator = null
  }

  update(dt: number, time: number): void {
    this.world.player.update(dt, time)
    this.world.update(dt)
  }

  render(): void {
    this.world.render()
  }

  resize(): void {
    this.world.resize()
  }

  private onStart = (): void => {
    this.navigator?.navigate_next_scene()
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      this.onStart()
    }
  }
}
