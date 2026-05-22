import './style.css'
import { SceneManager } from './scenes/SceneManager'
import { TitleScene } from './scenes/TitleScene'

const manager = new SceneManager()
manager.start(new TitleScene())

window.addEventListener('resize', () => manager.resize())

let prev = 0
const tick = (time: number) => {
  const dt = prev === 0 ? 0 : (time - prev) / 1000
  prev = time
  manager.update(dt, time)
  manager.render()
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
