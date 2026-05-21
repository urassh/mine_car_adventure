import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import { ARCH_SPACING, WOOD_THICKNESS, postCenterXAt } from './Arches'

// 壁際のアーチ柱に取り付けた松明。アーチと同じ要領で Z 方向にチェーンさせ、
// カメラ後方に抜けたら奥に戻す。
//
// 1 松明 = 暖色の PointLight + 小さなエミッシブ箱 (光源そのものの見た目)。
// ちらつきは「短い間隔で乱数ターゲットを再サンプリングし、現在値をそこへ
// 緩やかに追従させる」方式。sin の合成だと周期が透けて見えるので、
// 完全に確率的な値ノイズで非周期にする。
//
// 柱に「付いて見える」ようにするための前提:
//   - Z は ARCH_SPACING (= 柱の Z 間隔) の倍数にスナップ。
//     Torches/Arches は同じ速度で流れ、かつ Torches のチェーン長も
//     ARCH_SPACING の倍数なので、リサイクル後も常にどれかの柱と Z が一致する。
//   - X は当該高さでの柱中心から内側へ WOOD_THICKNESS/2 ずらし、
//     頭の箱が柱の内側面に食い込む位置に置く。

const TORCH_COUNT = 16
// 間隔は ARCH_SPACING (4m) の倍数からランダムに選ぶ。
// 平均 8m 相当になるよう 2x を重めにブレンド。
const SPACING_CHOICES = [ARCH_SPACING, ARCH_SPACING * 2, ARCH_SPACING * 2, ARCH_SPACING * 3]
const TORCH_Y = 1.6 // 目線よりやや上 (柱の Y 範囲 0..2.1 の内側)
const HEIGHT_JITTER = 0.25 // Y 方向 ±0.25m。これも ARCH_SPACING に依存しない
const HEAD_SIZE = 0.14
const MAX_SAME_SIDE_RUN = 2 // 同じ壁面の連続上限

const TORCH_COLOR = 0xffaa55 // 暖色 (やや赤寄りオレンジ)
const TORCH_BASE_INTENSITY = 2.4
const TORCH_DISTANCE = 9 // 光の届く距離 (これより遠くは 0)
const TORCH_DECAY = 2

// ちらつきの強さ (ベース強度に対する揺れ幅)
const FLICKER_AMPLITUDE = 0.3
// ターゲット値の再サンプリング間隔 [秒]
const RESAMPLE_MIN = 0.04
const RESAMPLE_MAX = 0.18
// 現在値がターゲットへ追従する速度 (1/秒)。大きいほど鋭いちらつき
const FOLLOW_RATE = 18

type Torch = {
  group: THREE.Group
  light: THREE.PointLight
  noise: number // 現在の揺らぎ値 [-1, 1] 付近
  target: number // 次に向かう値 [-1, 1]
  resampleTimer: number // 次に target を引き直すまでの残り秒
}

const sampleTarget = () => Math.random() * 2 - 1
const sampleInterval = () => RESAMPLE_MIN + Math.random() * (RESAMPLE_MAX - RESAMPLE_MIN)

export class Torches extends THREE.Group {
  private readonly torches: Torch[] = []
  private readonly chainLength: number

  constructor() {
    super()

    const headGeometry = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE)
    // 光源そのものは常に明るく見えるように emissive 強め。
    // 暗いシーンでもこの箱は浮き上がる。
    const headMaterial = new THREE.MeshBasicMaterial({ color: TORCH_COLOR })

    let lastSide = 0
    let sameSideRun = 0
    let z = 0

    for (let i = 0; i < TORCH_COUNT; i++) {
      const group = new THREE.Group()

      // 左右はランダムだが、同じ壁面が続きすぎないように上限を設ける
      let side: number
      if (sameSideRun >= MAX_SAME_SIDE_RUN) {
        side = -lastSide
      } else {
        side = Math.random() < 0.5 ? -1 : 1
      }
      if (side === lastSide) {
        sameSideRun++
      } else {
        lastSide = side
        sameSideRun = 1
      }

      // 高さは目線よりやや上を中心にゆらす (柱の Y 範囲内)
      const y = TORCH_Y + (Math.random() * 2 - 1) * HEIGHT_JITTER
      // 該当高さでの柱中心 X から内側へ WOOD_THICKNESS/2 だけ寄せる:
      // 頭の箱の外端がちょうど柱の内側面に当たる位置
      const x = side * (postCenterXAt(y) - WOOD_THICKNESS / 2)
      group.position.set(x, y, z)

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
      this.torches.push({
        group,
        light,
        noise: 0,
        target: sampleTarget(),
        resampleTimer: sampleInterval(),
      })

      // 次の松明までの間隔を ARCH_SPACING の倍数から選ぶ
      z -= SPACING_CHOICES[Math.floor(Math.random() * SPACING_CHOICES.length)]
    }

    // チェーン長 = 全松明の合計間隔 (-z の総和)。
    // ARCH_SPACING の倍数なので、リサイクル後も Z はアーチ柱と整合する。
    this.chainLength = -z
  }

  update(dt: number) {
    const ds = FORWARD_SPEED * dt
    // 指数追従の係数。dt 依存のフレームレート非依存な低域通過
    const followAlpha = 1 - Math.exp(-FOLLOW_RATE * dt)
    for (const t of this.torches) {
      t.group.position.z += ds
      if (t.group.position.z > RECYCLE_Z) {
        t.group.position.z -= this.chainLength
      }

      t.resampleTimer -= dt
      if (t.resampleTimer <= 0) {
        t.target = sampleTarget()
        t.resampleTimer = sampleInterval()
      }
      t.noise += (t.target - t.noise) * followAlpha
      t.light.intensity = TORCH_BASE_INTENSITY * (1 + FLICKER_AMPLITUDE * t.noise)
    }
  }
}
