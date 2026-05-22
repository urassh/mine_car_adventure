import type { NextSceneNavigator } from './NextSceneNavigator'

export abstract class Scene {
  mount(_navigator: NextSceneNavigator): void {}
  unmount(): void {}
  update(_dt: number, _time: number): void {}
  render(): void {}
  resize(): void {}
}
