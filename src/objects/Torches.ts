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
const MAX_SAME_SIDE_RUN = 2 // 同じ壁面の連続上限

// --- 松明の各パーツ寸法 ---
// 形状: 柄 (木) → 布巻き (黒っぽい布/油布) → 炎 (円錐) を一直線に並べる。
// 柄は壁面 (柱の内側面) から水平にトンネル中央方向へ突き出す。
// 炎は布巻きの真上に立ち上げる。
const HANDLE_LENGTH = 0.28
const HANDLE_RADIUS = 0.024
const WRAP_LENGTH = 0.1 // 布巻きの長さ (柄方向)
const WRAP_RADIUS = 0.044 // 布巻きの太さ (柄より一回り太く)
const FLAME_HEIGHT = 0.18
const FLAME_RADIUS = 0.055

const TORCH_COLOR = 0xffaa55 // 暖色 (やや赤寄りオレンジ)
const TORCH_BASE_INTENSITY = 2.4
const TORCH_DISTANCE = 9 // 光の届く距離 (これより遠くは 0)
const TORCH_DECAY = 2

// ちらつきの強さ (ベース強度に対する揺れ幅)
const FLICKER_AMPLITUDE = 0.3
// 炎メッシュの縦方向スケール揺れ幅 (1 + AMP * noise)
const FLAME_FLICKER = 0.2
// ターゲット値の再サンプリング間隔 [秒]
const RESAMPLE_MIN = 0.04
const RESAMPLE_MAX = 0.18
// 現在値がターゲットへ追従する速度 (1/秒)。大きいほど鋭いちらつき
const FOLLOW_RATE = 18

type Torch = {
  group: THREE.Group
  flame: THREE.Mesh
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

    // --- 共有マテリアル ---
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a2410, // ヤニで黒ずんだ木
      roughness: 0.9,
    })
    const wrapMaterial = new THREE.MeshStandardMaterial({
      color: 0x140a04, // 油布。ほぼ黒だが炎の光を受けて辛うじて見える
      roughness: 0.95,
    })
    // 炎は自身が「光源そのもの」として常に明るく見えるよう unlit。
    // PointLight でちらつく実光源も別に立てる。
    const flameMaterial = new THREE.MeshBasicMaterial({ color: TORCH_COLOR })

    // --- 共有ジオメトリ ---
    // CylinderGeometry のデフォルト軸は Y。Z 回りに 90° 回して X 軸に倒す。
    const handleGeometry = new THREE.CylinderGeometry(
      HANDLE_RADIUS,
      HANDLE_RADIUS,
      HANDLE_LENGTH,
      8,
    )
    handleGeometry.rotateZ(Math.PI / 2)
    // 布巻きは先端側がわずかに細い (rolled rag っぽさ)
    const wrapGeometry = new THREE.CylinderGeometry(
      WRAP_RADIUS,
      WRAP_RADIUS * 0.85,
      WRAP_LENGTH,
      10,
    )
    wrapGeometry.rotateZ(Math.PI / 2)
    // 炎は上向きの円錐 (デフォルト Y 軸でそのまま使える)
    const flameGeometry = new THREE.ConeGeometry(FLAME_RADIUS, FLAME_HEIGHT, 8)

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
      // 柄の根元 (group 原点) がちょうど柱の内側面に当たる位置
      const x = side * (postCenterXAt(y) - WOOD_THICKNESS / 2)
      group.position.set(x, y, z)

      // 柄はトンネル中央方向に伸ばす。右壁 (side=1) では -X 方向、左壁 (side=-1) では +X 方向。
      const dir = -side

      const handle = new THREE.Mesh(handleGeometry, handleMaterial)
      handle.position.set((dir * HANDLE_LENGTH) / 2, 0, 0)
      group.add(handle)

      // 布巻きは柄の先端寄り
      const wrapX = dir * (HANDLE_LENGTH - WRAP_LENGTH / 2)
      const wrap = new THREE.Mesh(wrapGeometry, wrapMaterial)
      wrap.position.set(wrapX, 0, 0)
      group.add(wrap)

      // 炎は布巻きの真上に立ち上げる
      const flameY = WRAP_RADIUS + FLAME_HEIGHT / 2
      const flame = new THREE.Mesh(flameGeometry, flameMaterial)
      flame.position.set(wrapX, flameY, 0)
      group.add(flame)

      // 光源は炎の中心に置く (柄の根元ではなく)。距離減衰が実物の松明らしくなる
      const light = new THREE.PointLight(
        TORCH_COLOR,
        TORCH_BASE_INTENSITY,
        TORCH_DISTANCE,
        TORCH_DECAY,
      )
      light.position.set(wrapX, flameY, 0)
      group.add(light)

      this.add(group)
      this.torches.push({
        group,
        flame,
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
      // 炎メッシュは縦方向にだけ伸び縮みさせる (実際の炎が瞬時に高さを変える挙動)
      t.flame.scale.y = 1 + FLAME_FLICKER * t.noise
    }
  }
}
