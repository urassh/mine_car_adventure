import { KeyboardInput } from '../controllers/keyboard_input'
import { PlayController } from '../controllers/play_controller'
import type { MultiConnection } from '../multi/MultiConnection'
import { loadQuizData } from '../quiz/QuizData'
import { DataStore } from '../stores/DataStore'
import { WorldRenderer } from '../views/render/WorldRenderer'
import { QuizView } from '../views/ui/QuizView'
import type { NextSceneNavigator } from './NextSceneNavigator'
import { Scene } from './Scene'

interface PlayOptions {
  readonly connection?: MultiConnection
}

export class PlayScene extends Scene {
  private world!: WorldRenderer
  private view!: QuizView
  private store!: DataStore
  private play!: PlayController
  private keyboard!: KeyboardInput
  private navigator: NextSceneNavigator | null = null
  private transitioned = false
  private readonly connection?: MultiConnection

  constructor(options: PlayOptions = {}) {
    super()
    this.connection = options.connection
  }

  mount(navigator: NextSceneNavigator): void {
    this.navigator = navigator
    const app = document.querySelector<HTMLDivElement>('#app')!
    this.world = new WorldRenderer(app)
    this.view = new QuizView(document)
    this.store = new DataStore()
    this.store.clearResults()
    this.play = new PlayController(this.world, this.view, this.store)
    this.keyboard = new KeyboardInput(this.play)
    this.keyboard.attach()

    this.connection?.start({ onVote: (v) => this.play.onVote(v) })

    loadQuizData()
      .then((qs) => this.play.setQuestions(qs))
      .catch((err) => console.error(err))
  }

  unmount(): void {
    this.connection?.stop()
    this.keyboard.detach()
    this.view.hideAll()
    this.world.dispose()
    this.navigator = null
  }

  update(dt: number, time: number): void {
    if (this.transitioned) return
    this.play.update(dt)
    if (this.play.completed) {
      this.transitioned = true
      this.navigator?.navigate_next_scene()
      return
    }
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
}
