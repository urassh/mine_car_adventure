import * as THREE from 'three'
import './style.css'
import {
  CAMERA_HEIGHT,
  CAMERA_LOOK_AHEAD,
  CAMERA_SHAKE_AMP_X,
  CAMERA_SHAKE_AMP_Y,
  CAMERA_SHAKE_FREQ_X,
  CAMERA_SHAKE_FREQ_Y,
} from './constants'
import { Arches } from './objects/Arches'
import { MineCart } from './objects/MineCart'
import { Rails } from './objects/Rails'
import { Ties } from './objects/Ties'
import { Torches } from './objects/Torches'
import { Tunnel } from './objects/Tunnel'

const app = document.querySelector<HTMLDivElement>('#app')!

// 闇に溶ける背景色。フォグの色と合わせる
const DARK = 0x050505

const scene = new THREE.Scene()
scene.background = new THREE.Color(DARK)
// 指数フォグで遠景を完全に闇に。ループのつなぎ目もこれで隠れる
scene.fog = new THREE.FogExp2(DARK, 0.07)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, CAMERA_HEIGHT, 0)
camera.lookAt(0, CAMERA_HEIGHT, -CAMERA_LOOK_AHEAD)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

// 廃坑の暗がり。環境光はほぼゼロにして、実質的に松明だけが光源になる
const ambient = new THREE.AmbientLight(0xffffff, 0.04)
scene.add(ambient)

const rails = new Rails()
const ties = new Ties()
const tunnel = new Tunnel()
const arches = new Arches()
const torches = new Torches()
scene.add(rails)
scene.add(ties)
scene.add(tunnel)
scene.add(arches)
scene.add(torches)

// 一人称トロッコの縁。カメラに追従させたいのでカメラの子にする。
// 子要素の描画にはカメラ自身がシーン階層下にある必要があるため scene.add(camera) も入れる。
const cart = new MineCart()
camera.add(cart)
scene.add(camera)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const TWO_PI = Math.PI * 2

let prevTime = 0
renderer.setAnimationLoop((time) => {
  // time は ms。初回フレームは dt=0 として扱う
  const dt = prevTime === 0 ? 0 : (time - prevTime) / 1000
  prevTime = time
  rails.update(dt)
  ties.update(dt)
  tunnel.update(dt)
  arches.update(dt)
  torches.update(dt)

  // カメラの微小な揺れ。
  // 主周波数 + 非整数倍のサブ周波数を重ねて、規則的な往復に見えないようにする。
  // x は左右、y は上下。位相をずらして両軸の最大値が同時に来るのを避ける。
  const t = time / 1000
  const shakeX =
    Math.sin(t * CAMERA_SHAKE_FREQ_X * TWO_PI) * CAMERA_SHAKE_AMP_X +
    Math.sin(t * CAMERA_SHAKE_FREQ_X * 1.7 * TWO_PI + 1.3) * CAMERA_SHAKE_AMP_X * 0.4
  const shakeY =
    Math.sin(t * CAMERA_SHAKE_FREQ_Y * TWO_PI + 0.7) * CAMERA_SHAKE_AMP_Y +
    Math.cos(t * CAMERA_SHAKE_FREQ_Y * 1.3 * TWO_PI) * CAMERA_SHAKE_AMP_Y * 0.5
  camera.position.x = shakeX
  camera.position.y = CAMERA_HEIGHT + shakeY

  renderer.render(scene, camera)
})
