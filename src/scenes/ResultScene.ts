import { DataStore } from '../stores/DataStore'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { Scene } from './Scene'

export class ResultScene extends Scene {
  private overlay: HTMLDivElement | null = null
  private nextButton: HTMLButtonElement | null = null
  private navigator: NextSceneNavigator | null = null

  mount(navigator: NextSceneNavigator): void {
    this.navigator = navigator

    const store = new DataStore()
    const correct = store.correctCount
    const total = store.answeredCount

    this.overlay = document.querySelector<HTMLDivElement>('#final-result-overlay')
    this.nextButton = this.overlay?.querySelector<HTMLButtonElement>('.next') ?? null

    const score = this.overlay?.querySelector<HTMLDivElement>('.final-score')
    if (score) score.textContent = `${correct} / ${total}`

    this.overlay?.classList.remove('hidden')
    this.nextButton?.addEventListener('click', this.onNext)
  }

  unmount(): void {
    this.nextButton?.removeEventListener('click', this.onNext)
    this.overlay?.classList.add('hidden')
    this.navigator = null
  }

  private onNext = (): void => {
    this.navigator?.navigate_next_scene()
  }
}
