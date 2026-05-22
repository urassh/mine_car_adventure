import './style.css'
import { KeyboardInput } from './controllers/keyboard_input'
import { PlayController } from './controllers/play_controller'
import { loadQuizData } from './quiz/QuizData'
import { WorldRenderer } from './render/WorldRenderer'
import { QuizView } from './ui/QuizView'

const app = document.querySelector<HTMLDivElement>('#app')!

const world = new WorldRenderer(app)
const view = new QuizView(document)
const play = new PlayController(world, view)
const keyboard = new KeyboardInput(play)

keyboard.attach()
window.addEventListener('resize', () => world.resize())
loadQuizData()
  .then((qs) => play.setQuestions(qs))
  .catch((err) => console.error(err))

let prev = 0
const tick = (time: number) => {
  const dt = prev === 0 ? 0 : (time - prev) / 1000
  prev = time
  play.update(dt)
  world.player.update(dt, time)
  world.update(dt)
  world.render()
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
