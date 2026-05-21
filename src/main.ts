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
import { Branch, BRANCH_OFFSET, BRANCH_TRAVERSE } from './objects/Branch'
import { Dust } from './objects/Dust'
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

// 廃坑の暗がり。松明 (暖色 0xffaa55) と馴染むよう、環境光もごく薄い暖色寄りに。
// 強度は「松明の届かない壁面が真っ黒すぎず、奥行きがうっすら見える」程度に抑える。
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

// --- 左右分岐 ---
// 矢印キーで Y 字分岐ピース (Branch) を奥にスポーンする。
// 分岐ピース自身はシーン直下に置き、本線側 (rails/ties/tunnel/arches/torches/dust) と
// カメラの両方を同じ量だけ横シフトする。
//   → 本線とカメラの相対位置は変わらないので本線は常にカメラ直下にあるように見え、
//     シフトされない Branch ピースだけがカメラ視野内で横に流れる
//     = 「選んだ腕に乗ってもう一方が反対側に外れていく」視覚効果になる。
// 分岐通過後は baseLateral に焼き込み、それ以降を新たな中央線とする。
let activeBranch: Branch | null = null
let branchSide: 1 | -1 = 1
let baseLateral = 0

const laterallyShifted = [rails, ties, tunnel, arches, torches, dust]

const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function spawnBranch(side: 1 | -1) {
  if (activeBranch) return
  branchSide = side
  const branch = new Branch()
  // 現在の中央線上にスポーンさせる (本線と同じ横位置から Y が始まる)
  branch.position.x = baseLateral
  scene.add(branch)
  activeBranch = branch
}

window.addEventListener('keydown', (e) => {
  // 矢印キーはブラウザが既定でページスクロールに使うため、
  // 受け取った時点で preventDefault しておかないとフォーカス状況によって反応が消える。
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    spawnBranch(1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    spawnBranch(-1)
  }
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
  dust.update(dt)

  // 分岐ピースの進行と横シフト量の決定。
  // position.z は 0 (合流端がカメラに到達) → BRANCH_TRAVERSE (発散端がカメラに到達) と進み、
  // この区間で smoothstep 補間して baseLateral → baseLateral + side*BRANCH_OFFSET に推移させる。
  let lateral = baseLateral
  if (activeBranch) {
    activeBranch.update(dt)
    const z = activeBranch.position.z
    if (z >= 0) {
      const t = Math.min(z / BRANCH_TRAVERSE, 1)
      lateral = baseLateral + branchSide * BRANCH_OFFSET * smoothstep(t)
    }
    if (activeBranch.done) {
      baseLateral += branchSide * BRANCH_OFFSET
      scene.remove(activeBranch)
      activeBranch = null
    }
  }
  for (const obj of laterallyShifted) {
    obj.position.x = lateral
  }

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
  camera.position.x = shakeX + lateral
  camera.position.y = CAMERA_HEIGHT + shakeY

  renderer.render(scene, camera)
})
