import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'

// 壁際に等間隔に並ぶ松明。アーチと同じ要領で Z 方向にチェーンさせ、
// カメラ後方に抜けたら奥に戻す。
//
// 1 松明 = 暖色の PointLight + 小さなエミッシブ箱 (光源そのものの見た目)。
// 個体ごとに位相をずらして sin で揺らし、炎のちらつきを出す。

const TORCH_SPACING = 8 // 進行方向の松明間隔
const TORCH_COUNT = 16
const TORCH_X = 0.55 // 壁寄り (アーチ柱の少し内側)
const TORCH_Y = 1.8 // 目線よりやや上
const HEAD_SIZE = 0.14

const TORCH_COLOR = 0xffaa55 // 暖色 (やや赤寄りオレンジ)
const TORCH_BASE_INTENSITY = 2.4
const TORCH_DISTANCE = 9 // 光の届く距離 (これより遠くは 0)
const TORCH_DECAY = 2

// ちらつき: 主波 + やや高い倍音を足して規則的すぎないようにする
const FLICKER_AMPLITUDE = 0.25 // ベース強度に対する揺れ幅
const FLICKER_FREQ_A = 7.0
const FLICKER_FREQ_B = 13.0

type Torch = {
  group: THREE.Group
  light: THREE.PointLight
  phase: number
}

export class Torches extends THREE.Group {
  private readonly torches: Torch[] = []
  private readonly chainLength: number
  private elapsed = 0

  constructor() {
    super()
    this.chainLength = TORCH_SPACING * TORCH_COUNT

    const headGeometry = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE)
    // 光源そのものは常に明るく見えるように emissive 強め。
    // 暗いシーンでもこの箱は浮き上がる。
    const headMaterial = new THREE.MeshBasicMaterial({ color: TORCH_COLOR })

    for (let i = 0; i < TORCH_COUNT; i++) {
      const group = new THREE.Group()
      // 左右交互に取り付け
      const side = i % 2 === 0 ? -1 : 1
      group.position.set(side * TORCH_X, TORCH_Y, -TORCH_SPACING * i)

      const head = new THREE.Mesh(headGeometry, headMaterial)
      group.add(head)

      const light = new THREE.PointLight(
        TORCH_COLOR,
        TORCH_BASE_INTENSITY,
        TORCH_DISTANCE,
        TORCH_DECAY,
      )
      group.add(light)

      this.add(group)
      this.torches.push({ group, light, phase: Math.random() * Math.PI * 2 })
    }
  }

  update(dt: number) {
    this.elapsed += dt
    const ds = FORWARD_SPEED * dt
    for (const t of this.torches) {
      t.group.position.z += ds
      if (t.group.position.z > RECYCLE_Z) {
        t.group.position.z -= this.chainLength
      }
      // 2 つの sin を足し合わせて炎っぽく不規則に
      const flicker =
        Math.sin(this.elapsed * FLICKER_FREQ_A + t.phase) * 0.6 +
        Math.sin(this.elapsed * FLICKER_FREQ_B + t.phase * 1.7) * 0.4
      t.light.intensity = TORCH_BASE_INTENSITY * (1 + FLICKER_AMPLITUDE * flicker)
    }
  }
}
