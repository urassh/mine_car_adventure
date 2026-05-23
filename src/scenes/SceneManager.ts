import { LobbyScene } from './LobbyScene'
import { ModeSelectScene } from './ModeSelectScene'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { PlayScene } from './PlayScene'
import { ResultScene } from './ResultScene'
import { Scene } from './Scene'
import { TitleScene } from './TitleScene'

export class SceneManager implements NextSceneNavigator {
  private current: Scene | null = null

  start(initial: Scene): void {
    this.swap(initial)
  }

  navigate_next_scene(): void {
    if (!this.current) return
    this.swap(this.resolveNext(this.current))
  }

  update(dt: number, time: number): void {
    this.current?.update(dt, time)
  }

  render(): void {
    this.current?.render()
  }

  resize(): void {
    this.current?.resize()
  }

  private resolveNext(current: Scene): Scene {
    if (current instanceof TitleScene) return new ModeSelectScene()
    if (current instanceof ModeSelectScene) {
      return current.chosenMode === 'multi' ? new LobbyScene() : new PlayScene()
    }
    if (current instanceof LobbyScene) return new PlayScene({ connection: current.connection })
    if (current instanceof PlayScene) return new ResultScene()
    if (current instanceof ResultScene) return new TitleScene()
    return new TitleScene()
  }

  private swap(next: Scene): void {
    this.current?.unmount()
    this.current = next
    next.mount(this)
  }
}
