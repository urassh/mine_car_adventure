import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'

// sample2 の組み木をイメージした六角アーチ形:
//
//          /\        ← 屋根梁 2 本が頂点 (apex) で合流
//         /  \
//        |    |      ← 側面柱 2 本 (やや上窄まり)
//        |    |
//        --rail--
//
// すべて Box の角材で構成し、傾きをつけて配置。

// 角材の太さ (角断面)
export const WOOD_THICKNESS = 0.18

// 側面柱の端点
// 足元はトンネル壁 (y=0 で ±0.8) のすぐ内側に寄せる
export const POST_BOTTOM_X = 0.78
export const POST_TOP_X = 0.5 // 頂部はやや内側に寄る (上窄まり)
export const POST_BOTTOM_Y = 0
export const POST_TOP_Y = 2.1

// 屋根の頂点 (中央)
const APEX_Y = 2.5

// 配置 (Z 方向)
export const ARCH_SPACING = 4
const ARCH_COUNT = 50

// 指定の高さ y における側面柱中心の |x|。柱に物を付けるとき用。
export function postCenterXAt(y: number): number {
  const t = (y - POST_BOTTOM_Y) / (POST_TOP_Y - POST_BOTTOM_Y)
  return POST_BOTTOM_X + (POST_TOP_X - POST_BOTTOM_X) * t
}

// --- 派生値 (端点から角度・長さ・中心を計算) ---
const POST_LENGTH = Math.hypot(POST_BOTTOM_X - POST_TOP_X, POST_TOP_Y - POST_BOTTOM_Y)
const POST_TILT = Math.atan2(POST_BOTTOM_X - POST_TOP_X, POST_TOP_Y - POST_BOTTOM_Y)
const POST_CENTER_X = (POST_BOTTOM_X + POST_TOP_X) / 2
const POST_CENTER_Y = (POST_BOTTOM_Y + POST_TOP_Y) / 2

const ROOF_LENGTH = Math.hypot(POST_TOP_X, APEX_Y - POST_TOP_Y)
const ROOF_TILT = Math.atan2(POST_TOP_X, APEX_Y - POST_TOP_Y)
const ROOF_CENTER_X = POST_TOP_X / 2
const ROOF_CENTER_Y = (POST_TOP_Y + APEX_Y) / 2

// 廃坑の組み木支柱。1 アーチ = 側面柱 2 本 + 屋根梁 2 本。
// 1 アーチを Group にまとめ、レール等と同じ要領で Z 方向にリサイクル。
export class Arches extends THREE.Group {
  private readonly arches: THREE.Group[] = []
  private readonly chainLength: number

  constructor() {
    super()
    this.chainLength = ARCH_SPACING * ARCH_COUNT

    const postGeometry = new THREE.BoxGeometry(WOOD_THICKNESS, POST_LENGTH, WOOD_THICKNESS)
    const roofGeometry = new THREE.BoxGeometry(WOOD_THICKNESS, ROOF_LENGTH, WOOD_THICKNESS)
    const material = new THREE.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.95,
    })

    for (let i = 0; i < ARCH_COUNT; i++) {
      const arch = new THREE.Group()

      // 左側面柱: 上に行くほど中央に寄る (rotation.z は負方向)
      const leftPost = new THREE.Mesh(postGeometry, material)
      leftPost.position.set(-POST_CENTER_X, POST_CENTER_Y, 0)
      leftPost.rotation.z = -POST_TILT
      arch.add(leftPost)

      // 右側面柱: 鏡像
      const rightPost = new THREE.Mesh(postGeometry, material)
      rightPost.position.set(POST_CENTER_X, POST_CENTER_Y, 0)
      rightPost.rotation.z = POST_TILT
      arch.add(rightPost)

      // 左屋根梁: 柱の頂部 (-POST_TOP_X, POST_TOP_Y) → 頂点 (0, APEX_Y)
      const leftRoof = new THREE.Mesh(roofGeometry, material)
      leftRoof.position.set(-ROOF_CENTER_X, ROOF_CENTER_Y, 0)
      leftRoof.rotation.z = -ROOF_TILT
      arch.add(leftRoof)

      // 右屋根梁: 鏡像
      const rightRoof = new THREE.Mesh(roofGeometry, material)
      rightRoof.position.set(ROOF_CENTER_X, ROOF_CENTER_Y, 0)
      rightRoof.rotation.z = ROOF_TILT
      arch.add(rightRoof)

      arch.position.z = -ARCH_SPACING * i
      this.add(arch)
      this.arches.push(arch)
    }
  }

  update(dt: number) {
    const ds = FORWARD_SPEED * dt
    for (const arch of this.arches) {
      arch.position.z += ds
      if (arch.position.z > RECYCLE_Z) {
        arch.position.z -= this.chainLength
      }
    }
  }
}
