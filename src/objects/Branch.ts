import * as THREE from 'three'
import { FORWARD_SPEED } from '../constants'
import { createMetalTextures, createRockTextures } from '../textures/procedural'
import { TIE_HEIGHT } from './Ties'
import { TUNNEL_CENTER_Y, TUNNEL_RADIUS } from './Tunnel'

// Y 字分岐ピース。
// レール 4 本 + 単一の手組み Y 字トンネルメッシュ (本線と同じ岩肌マテリアル、BackSide)。
//
// トンネルは「断面が長さ方向に滑らかに変形する 1 枚のメッシュ」として作る:
//   v=0 (合流端)   : 半径 R の真円 1 つ
//   v=1 (発散端)   : 中心が (±d, 0) の半径 R 円 2 つの和集合 (= peanut 型)
// 単一連結を保つために 0 < d < R が必須。d が R を超えると 2 円が分離し、
// メッシュが破綻する。
//
// 旧実装 (傾き円筒 2 本の重ね合わせ) と違い:
//   - 円筒同士の交差がないので「壁の中の壁」のような pentagonal な影絵が出ない
//   - 合流端で本線円筒と頂点配置が一致する (どちらも半径 R, 中心 (0, TUNNEL_CENTER_Y))

// 発散端での腕中心線オフセット。
// TUNNEL_RADIUS = 1.7 に対して 1.5。単一メッシュ化のための制約 (d < R) で
// 旧 (2.5) より狭い。peanut の「くびれ」幅 = 2*sqrt(R^2 - d^2) ≒ 1.6m が
// 2 つの腕を隔てる岩稜の太さになる。
const BRANCH_LENGTH = 10
export const BRANCH_OFFSET = 1.5
export const BRANCH_TRAVERSE = BRANCH_LENGTH

const RAIL_WIDTH = 0.08
const RAIL_HEIGHT = 0.08
const RAIL_GAUGE = 1.0

const SPAWN_Z = -36
const DESPAWN_Z = BRANCH_LENGTH + 6

const railY = TIE_HEIGHT + RAIL_HEIGHT / 2

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

// 断面の周長を s ∈ [0, 1] で歩く。s=0 を上 (+y) として CCW (+z から見て)。
// d=0 で真円、0 < d < R で peanut。
// s=0.5 は下方の交点 ((x, y) = (0, -sqrt(R^2-d^2)))、s=0/1 は上方の交点。
function peanutBoundary(s: number, d: number, R: number): { x: number; y: number } {
  if (d < 1e-6) {
    // 真円。s=0 で上、CCW (+z から見て左回り) で進む
    const a = Math.PI / 2 + 2 * Math.PI * s
    return { x: R * Math.cos(a), y: R * Math.sin(a) }
  }
  // 2 円の和集合の境界 (= 大きい方の弧 2 本)。
  // 各円の中心から見て、交点の角度を alpha とすると、外向きの弧は
  // 角度 2π - 2α を占める。
  const alpha = Math.acos(d / R)
  if (s < 0.5) {
    // 左弧: 上交点 (s=0) → 左端 (-d-R, 0) → 下交点 (s=0.5)
    // 左円中心 (-d, 0) からのパラメータ ψ を α → 2π-α に進める
    const t = s * 2
    const psi = alpha + t * (2 * Math.PI - 2 * alpha)
    return { x: -d + R * Math.cos(psi), y: R * Math.sin(psi) }
  } else {
    // 右弧: 下交点 (s=0.5) → 右端 (d+R, 0) → 上交点 (s=1)
    // 右円中心 (+d, 0) からのパラメータ φ を π+α → 3π-α に進める
    const t = (s - 0.5) * 2
    const phi = Math.PI + alpha + t * (2 * Math.PI - 2 * alpha)
    return { x: d + R * Math.cos(phi), y: R * Math.sin(phi) }
  }
}

// Y 字トンネル本体のメッシュ。
// 周方向 radial+1 頂点 (i=radial は i=0 と座標一致だが UV 連続のため別頂点)、
// 長さ方向 longitudinal+1 行。
function buildBranchTunnelGeometry(
  R: number,
  offsetMax: number,
  length: number,
  radial: number,
  longitudinal: number,
): THREE.BufferGeometry {
  const verts: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let j = 0; j <= longitudinal; j++) {
    const v = j / longitudinal
    const d = offsetMax * v
    const z = -length * v
    for (let i = 0; i <= radial; i++) {
      const s = i / radial
      const p = peanutBoundary(s, d, R)
      verts.push(p.x, TUNNEL_CENTER_Y + p.y, z)
      uvs.push(s, v)
    }
  }

  // インデックス: 各クアッドを (a, c, b) (b, c, d) で 2 三角化。
  // a=(i,j), b=(i+1,j), c=(i,j+1), d=(i+1,j+1)。
  // この巻き方で「外向き」CCW (= 岩側から見て CCW) になり、computeVertexNormals
  // が外向き法線を出す。マテリアルは BackSide にして内側 (camera 側) に描画。
  const rowSize = radial + 1
  for (let j = 0; j < longitudinal; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * rowSize + i
      const b = a + 1
      const c = (j + 1) * rowSize + i
      const dd = c + 1
      indices.push(a, c, b)
      indices.push(b, c, dd)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}

export class Branch extends THREE.Group {
  done = false

  constructor() {
    super()

    // ---- レール 4 本 ----
    const { map: railMap, bumpMap: railBump } = createMetalTextures(1, 3)
    const railMaterial = new THREE.MeshStandardMaterial({
      map: railMap,
      bumpMap: railBump,
      bumpScale: 0.005,
      metalness: 0.6,
      roughness: 0.5,
    })

    const half = RAIL_GAUGE / 2
    const lines: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(-half, 0, 0), new THREE.Vector3(-BRANCH_OFFSET - half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(+half, 0, 0), new THREE.Vector3(-BRANCH_OFFSET + half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(-half, 0, 0), new THREE.Vector3(+BRANCH_OFFSET - half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(+half, 0, 0), new THREE.Vector3(+BRANCH_OFFSET + half, 0, -BRANCH_LENGTH)],
    ]
    for (const [start, end] of lines) {
      this.add(createTiltedRail(start, end, railMaterial))
    }

    // ---- Y 字トンネル (単一メッシュ) ----
    // 周方向: 本線 (32) の 2 倍を取って、peanut の「くびれ」近辺の曲率
    // 変化に追従させる。長さ方向: 2m 刻みでサンプル (BRANCH_LENGTH=10 → 5 行)
    // だと粗いので、断面形状の補間が滑らかに見えるよう少し多めに。
    const RADIAL = 64
    const LONGITUDINAL = 32
    const geom = buildBranchTunnelGeometry(
      TUNNEL_RADIUS,
      BRANCH_OFFSET,
      BRANCH_LENGTH,
      RADIAL,
      LONGITUDINAL,
    )
    // UV は s ∈ [0, 1] (周方向), v ∈ [0, 1] (長さ方向)。
    // 本線 (周 6 タイル / 長さ 2m/タイル) と密度を合わせる: repeatU=6, repeatV=5
    // (BRANCH_LENGTH=10 → 5 タイル)。周長は v とともに伸びるので終端では
    // 1 タイルあたりの実寸が大きくなるが、暗がりなので目立たない。
    const { map: tunnelMap, bumpMap: tunnelBump } = createRockTextures(6, 5)
    const tunnelMaterial = new THREE.MeshStandardMaterial({
      map: tunnelMap,
      bumpMap: tunnelBump,
      bumpScale: 0.6,
      roughness: 0.95,
      side: THREE.BackSide,
    })
    const tunnel = new THREE.Mesh(geom, tunnelMaterial)
    this.add(tunnel)

    this.position.set(0, 0, SPAWN_Z)
  }

  update(dt: number) {
    this.position.z += FORWARD_SPEED * dt
    if (this.position.z > DESPAWN_Z) {
      this.done = true
    }
  }
}
