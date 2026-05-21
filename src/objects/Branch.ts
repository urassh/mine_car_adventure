import * as THREE from 'three'
import { FORWARD_SPEED } from '../constants'
import { createMetalTextures, createRockTextures } from '../textures/procedural'
import { TIE_HEIGHT } from './Ties'
import { TUNNEL_CENTER_Y, TUNNEL_RADIUS } from './Tunnel'

// Y 字分岐ピース。レール 4 本 (左腕 2 本 + 右腕 2 本) と、各腕の中心線に沿った
// 傾き円筒トンネル 2 本 (本線と同じ岩肌マテリアル、BackSide) で構成する。
//
// ローカル座標:
//   - z = 0              : 合流端 (近端 = カメラ側)。両腕のレールが ±gauge/2 に重なる
//   - z = -BRANCH_LENGTH : 発散端 (奥)。左腕中心線は -BRANCH_OFFSET、右腕中心線は +BRANCH_OFFSET
//
// 「左右どちらに進むか」は Branch 自体には持たせず、メイン側で世界とカメラを
// 横にシフトすることで「選んだ腕に乗った」視覚を作る。

// 発散端での腕中心線オフセット。
// 本線トンネル半径 (1.7m) を超える距離を取って、2 本の円筒が末端で
// 横方向にはっきり離れて見えるようにする (半径未満だと常に重なって 1 本に潰れる)。
const BRANCH_LENGTH = 10
export const BRANCH_OFFSET = 2.5
export const BRANCH_TRAVERSE = BRANCH_LENGTH

const RAIL_WIDTH = 0.08
const RAIL_HEIGHT = 0.08
const RAIL_GAUGE = 1.0

// 「押したら奥に分岐が形成され、流れてくる」体験にするため、
// 押下時点ではフォグでほぼ霞む距離 (exp(-0.07*60) ≒ 1.5%) に出す。
// FORWARD_SPEED=8 で合流端がカメラに到達するまで 7.5 秒、その間に
// だんだん Y 字が浮かび上がってきて、最後にカートが通過する流れになる。
const SPAWN_Z = -60
// 発散端がカメラから 6m 後ろまで流れたら破棄
const DESPAWN_Z = BRANCH_LENGTH + 6

const railY = TIE_HEIGHT + RAIL_HEIGHT / 2

// 始点→終点を結ぶ傾いた角材レール 1 本を生成。
// BoxGeometry の長辺は局所 +Z 方向。mesh.rotation.y = θ で局所 +Z は
// world (sin θ, 0, cos θ) になる。これを (dx, 0, dz)/L に合わせるので θ = atan2(dx, dz)。
function createTiltedRail(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)
  const geom = new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, length)
  const mesh = new THREE.Mesh(geom, material)
  mesh.position.set((start.x + end.x) / 2, railY, (start.z + end.z) / 2)
  mesh.rotation.y = angle
  return mesh
}

export class Branch extends THREE.Group {
  done = false

  constructor() {
    super()

    // ---- レール 4 本 ----
    // 短いピースなので Z 方向のタイル数は控えめに。
    const { map: railMap, bumpMap: railBump } = createMetalTextures(1, 3)
    const railMaterial = new THREE.MeshStandardMaterial({
      map: railMap,
      bumpMap: railBump,
      bumpScale: 0.005,
      metalness: 0.6,
      roughness: 0.5,
    })

    const half = RAIL_GAUGE / 2
    // 合流端では両腕とも ±half で本線レールに重なる。
    const lines: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(-half, 0, 0), new THREE.Vector3(-BRANCH_OFFSET - half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(+half, 0, 0), new THREE.Vector3(-BRANCH_OFFSET + half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(-half, 0, 0), new THREE.Vector3(+BRANCH_OFFSET - half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(+half, 0, 0), new THREE.Vector3(+BRANCH_OFFSET + half, 0, -BRANCH_LENGTH)],
    ]
    for (const [start, end] of lines) {
      this.add(createTiltedRail(start, end, railMaterial))
    }

    // ---- 分岐トンネル 2 本 ----
    // 各腕の中心線に沿った傾き円筒。本線と同じ太さ・高さ・岩肌マテリアルで描き、
    // 視覚的に「本線が二股に分かれた」と読めるようにする。BackSide で内側だけ。
    // 合流端 (z=0) 付近では 2 本がほぼ同じ位置に重なり、発散端で離れる。
    const armLength = Math.sqrt(BRANCH_OFFSET * BRANCH_OFFSET + BRANCH_LENGTH * BRANCH_LENGTH)
    const tunnelGeom = new THREE.CylinderGeometry(
      TUNNEL_RADIUS,
      TUNNEL_RADIUS,
      armLength,
      32,
      1,
      true,
    )
    tunnelGeom.rotateX(Math.PI / 2)
    // 本線 (100m に 50 タイル = 2m/タイル) と同じ密度で岩肌を巻く
    const tilesAlongLength = Math.max(2, Math.round(armLength / 2))
    const { map: tunnelMap, bumpMap: tunnelBump } = createRockTextures(6, tilesAlongLength)
    const tunnelMaterial = new THREE.MeshStandardMaterial({
      map: tunnelMap,
      bumpMap: tunnelBump,
      bumpScale: 0.6,
      roughness: 0.95,
      side: THREE.BackSide,
    })

    for (const sign of [-1, 1] as const) {
      const mesh = new THREE.Mesh(tunnelGeom, tunnelMaterial)
      const dx = sign * BRANCH_OFFSET
      // 中心線の中点 (0,_,0)〜(dx,_,-LENGTH) の中間
      mesh.position.set(dx / 2, TUNNEL_CENTER_Y, -BRANCH_LENGTH / 2)
      // 局所 +Z を方向ベクトル (dx, 0, -LENGTH) に合わせる
      mesh.rotation.y = Math.atan2(dx, -BRANCH_LENGTH)
      this.add(mesh)
    }

    this.position.set(0, 0, SPAWN_Z)
  }

  update(dt: number) {
    this.position.z += FORWARD_SPEED * dt
    if (this.position.z > DESPAWN_Z) {
      this.done = true
    }
  }
}
