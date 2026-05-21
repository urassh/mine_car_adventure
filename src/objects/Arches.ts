import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import { createWoodTextures } from '../textures/procedural'

// sample2 の組み木をイメージした六角アーチ形:
//
//          /\        ← 屋根梁 2 本が頂点 (apex) で合流
//         /  \
//        |    |      ← 側面柱 2 本 (やや上窄まり)
//        |    |
//        --rail--
//
// すべて Box の角材で構成し、傾きをつけて配置。

// アーチ「基準形」のパラメータ。
// 各アーチはこの値からごく僅かにジッタした個別寸法で建てる。
// 外部 (Torches) はこの基準形を元にした postCenterXAt() で取り付け位置を決める。
// 実物の柱は ±数 cm ズレうるが、松明頭の箱 (0.14m) で十分吸収される。

// 角材の太さ (角断面)
const WOOD_THICKNESS_BASE = 0.18
// 側面柱の端点
const POST_BOTTOM_X_BASE = 0.78 // 足元 (トンネル壁 ±0.8 のすぐ内側)
const POST_TOP_X_BASE = 0.5 // 頂部はやや内側に寄る (上窄まり)
const POST_TOP_Y_BASE = 2.1
// 屋根の頂点 Y
const APEX_Y_BASE = 2.5

// 各アーチごとの ±ジッタ量。小さく保って「形が崩れた」感じにならないように
const WOOD_THICKNESS_JITTER = 0.03
const POST_BOTTOM_X_JITTER = 0.02 // トンネル壁を抜けないようごく小さく
const POST_TOP_X_JITTER = 0.05
const POST_TOP_Y_JITTER = 0.1
const APEX_Y_JITTER = 0.15
// アーチ全体に与える微小な傾き (古びた感じ)
const LEAN_X_JITTER = 0.03 // X 軸まわり: 前後にコクッと傾く [rad]
const ROLL_Z_JITTER = 0.02 // Z 軸まわり: 左右にコクッと傾く [rad]

export const POST_BOTTOM_Y = 0
// 外部からは基準形しか見えない (松明取付の座標決定に使う)
export const WOOD_THICKNESS = WOOD_THICKNESS_BASE
export const POST_BOTTOM_X = POST_BOTTOM_X_BASE
export const POST_TOP_X = POST_TOP_X_BASE
export const POST_TOP_Y = POST_TOP_Y_BASE

// 配置 (Z 方向)
export const ARCH_SPACING = 4
const ARCH_COUNT = 50

// 指定の高さ y における側面柱中心の |x| (基準形)。柱に物を付けるとき用。
export function postCenterXAt(y: number): number {
  const t = (y - POST_BOTTOM_Y) / (POST_TOP_Y - POST_BOTTOM_Y)
  return POST_BOTTOM_X + (POST_TOP_X - POST_BOTTOM_X) * t
}

const jitter = (amount: number) => (Math.random() * 2 - 1) * amount

// 廃坑の組み木支柱。1 アーチ = 側面柱 2 本 + 屋根梁 2 本。
// 1 アーチを Group にまとめ、レール等と同じ要領で Z 方向にリサイクル。
export class Arches extends THREE.Group {
  private readonly arches: THREE.Group[] = []
  private readonly chainLength: number

  constructor() {
    super()
    this.chainLength = ARCH_SPACING * ARCH_COUNT

    // マテリアルは共有でよい (色は変えない)
    // 柱長 ~2.2m、太さ 0.18m。長辺方向に 2 タイルで木目密度をほどよく調整。
    const { map, bumpMap } = createWoodTextures(1, 2)
    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.02,
      roughness: 0.95,
    })

    for (let i = 0; i < ARCH_COUNT; i++) {
      // --- このアーチ固有の寸法をジッタ ---
      const woodThickness = WOOD_THICKNESS_BASE + jitter(WOOD_THICKNESS_JITTER)
      const postBottomX = POST_BOTTOM_X_BASE + jitter(POST_BOTTOM_X_JITTER)
      const postTopX = POST_TOP_X_BASE + jitter(POST_TOP_X_JITTER)
      const postTopY = POST_TOP_Y_BASE + jitter(POST_TOP_Y_JITTER)
      const apexY = APEX_Y_BASE + jitter(APEX_Y_JITTER)

      // --- 派生値 (端点から角度・長さ・中心) ---
      const postLength = Math.hypot(postBottomX - postTopX, postTopY - POST_BOTTOM_Y)
      const postTilt = Math.atan2(postBottomX - postTopX, postTopY - POST_BOTTOM_Y)
      const postCenterX = (postBottomX + postTopX) / 2
      const postCenterY = (POST_BOTTOM_Y + postTopY) / 2

      const roofLength = Math.hypot(postTopX, apexY - postTopY)
      const roofTilt = Math.atan2(postTopX, apexY - postTopY)
      const roofCenterX = postTopX / 2
      const roofCenterY = (postTopY + apexY) / 2

      // ジオメトリは各アーチ固有 (長さ・太さがアーチごとに違うため)
      const postGeometry = new THREE.BoxGeometry(woodThickness, postLength, woodThickness)
      const roofGeometry = new THREE.BoxGeometry(woodThickness, roofLength, woodThickness)

      const arch = new THREE.Group()

      // 左側面柱: 上に行くほど中央に寄る (rotation.z は負方向)
      const leftPost = new THREE.Mesh(postGeometry, material)
      leftPost.position.set(-postCenterX, postCenterY, 0)
      leftPost.rotation.z = -postTilt
      arch.add(leftPost)

      // 右側面柱: 鏡像
      const rightPost = new THREE.Mesh(postGeometry, material)
      rightPost.position.set(postCenterX, postCenterY, 0)
      rightPost.rotation.z = postTilt
      arch.add(rightPost)

      // 左屋根梁: 柱の頂部 (-postTopX, postTopY) → 頂点 (0, apexY)
      const leftRoof = new THREE.Mesh(roofGeometry, material)
      leftRoof.position.set(-roofCenterX, roofCenterY, 0)
      leftRoof.rotation.z = -roofTilt
      arch.add(leftRoof)

      // 右屋根梁: 鏡像
      const rightRoof = new THREE.Mesh(roofGeometry, material)
      rightRoof.position.set(roofCenterX, roofCenterY, 0)
      rightRoof.rotation.z = roofTilt
      arch.add(rightRoof)

      // アーチ全体のごく微小な傾き (古びた感じ)
      arch.rotation.x = jitter(LEAN_X_JITTER)
      arch.rotation.z = jitter(ROLL_Z_JITTER)

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
