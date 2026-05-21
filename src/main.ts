import * as THREE from 'three'
import './style.css'
import { GameController } from './controllers/GameController'
import { KeyboardInput } from './controllers/KeyboardInput'
import { Arches } from './objects/Arches'
import { Branch } from './objects/Branch'
import { CameraRig } from './objects/CameraRig'
import { Dust } from './objects/Dust'
import { MineCart } from './objects/MineCart'
import { Rails } from './objects/Rails'
import { Ties } from './objects/Ties'
import { Torches } from './objects/Torches'
import { Tunnel } from './objects/Tunnel'

const app = document.querySelector<HTMLDivElement>('#app')!

const DARK = 0x050505

const scene = new THREE.Scene()
scene.background = new THREE.Color(DARK)
// 指数フォグで遠景を闇に。ループのつなぎ目もこれで隠れる。
scene.fog = new THREE.FogExp2(DARK, 0.07)

const cameraRig = new CameraRig()

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
// Tunnel が clippingPlanes で前方を切り落とすのに必要。
renderer.localClippingEnabled = true
app.appendChild(renderer.domElement)

const ambient = new THREE.AmbientLight(0xffcfa3, 0.15)
scene.add(ambient)

const rails = new Rails()
const ties = new Ties()
const tunnel = new Tunnel()
const arches = new Arches()
const torches = new Torches()
const dust = new Dust()
scene.add(rails)
scene.add(ties)
scene.add(tunnel)
scene.add(arches)
scene.add(torches)
scene.add(dust)

// カートはカメラに追従させるため子にする。camera 自身も scene 下にないと子が描画されない。
const cart = new MineCart()
cameraRig.camera.add(cart)
scene.add(cameraRig.camera)

window.addEventListener('resize', () => {
  cameraRig.resize()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const game = new GameController()
const keyboard = new KeyboardInput(game)
keyboard.attach()

// 分岐に乗るとき、本線とカメラを同じだけ横シフトする。分岐ピース自体は動かさないので
// 視野内で横に流れて見え、「片腕に乗って反対側が外れる」効果になる。
const laterallyShifted = [rails, ties, tunnel, arches, torches, dust]

let branchView: Branch | null = null

let prevTime = 0
renderer.setAnimationLoop((time) => {
  const dt = prevTime === 0 ? 0 : (time - prevTime) / 1000
  prevTime = time

  rails.update(dt)
  ties.update(dt)
  tunnel.update(dt)
  arches.update(dt)
  torches.update(dt)
  dust.update(dt)

  game.update(dt)

  if (game.branch) {
    if (!branchView) {
      branchView = new Branch()
      branchView.position.x = game.baseLateral
      scene.add(branchView)
    }
    branchView.position.z = game.branch.z
    tunnel.setClip(game.branch.z)
  } else if (branchView) {
    scene.remove(branchView)
    branchView = null
    tunnel.clearClip()
  }

  for (const obj of laterallyShifted) {
    obj.position.x = game.lateral
  }

  cameraRig.setLateral(game.lateral)
  cameraRig.setRoll(game.roll)
  cameraRig.tick(time)

  renderer.render(scene, cameraRig.camera)
})
