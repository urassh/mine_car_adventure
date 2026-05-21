import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import { createRockTextures } from '../textures/procedural'

// 横倒し円筒の寸法
// カメラ (y=1.4) を円筒のほぼ中心に置くことで、壁/天井に近づき
// トンネルに「包まれてる」感じを出す
const TUNNEL_RADIUS = 1.7
const TUNNEL_CENTER_Y = 1.5 // 床: -0.2 (レール直下), 天井: 3.2
const TUNNEL_SEGMENT_LENGTH = 100
const TUNNEL_SEGMENT_COUNT = 2 // >=2 でリサイクル可
const TUNNEL_RADIAL_SEGMENTS = 32

// 廃坑のトンネル壁 + 天井。
// 円筒を Z 軸方向に寝かせて内側だけを描画 (BackSide)。
// レール同様、セグメントをチェーンさせてカメラ後方を抜けたら奥に戻す。
export class Tunnel extends THREE.Group {
  private readonly segments: THREE.Mesh[] = []
  private readonly chainLength: number

  constructor() {
    super()

    this.chainLength = TUNNEL_SEGMENT_LENGTH * TUNNEL_SEGMENT_COUNT

    const geometry = new THREE.CylinderGeometry(
      TUNNEL_RADIUS,
      TUNNEL_RADIUS,
      TUNNEL_SEGMENT_LENGTH,
      TUNNEL_RADIAL_SEGMENTS,
      1,
      true, // openEnded: 端を塞がない (セグメント同士の境を見せない)
    )
    // 軸を Y → Z に倒す
    geometry.rotateX(Math.PI / 2)

    // 内周 2π*1.7 ≒ 10.7m、長さ 100m。
    // 円周方向に 6 タイル (≒ 1.78m/タイル)、長さ方向に 50 タイル (= 2m/タイル) で岩肌を貼る。
    const { map, bumpMap } = createRockTextures(6, 50)
    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.6,
      roughness: 0.95,
      side: THREE.BackSide,
    })

    for (let i = 0; i < TUNNEL_SEGMENT_COUNT; i++) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(
        0,
        TUNNEL_CENTER_Y,
        -TUNNEL_SEGMENT_LENGTH / 2 - i * TUNNEL_SEGMENT_LENGTH,
      )
      this.add(mesh)
      this.segments.push(mesh)
    }
  }

  update(dt: number) {
    const ds = FORWARD_SPEED * dt
    for (const seg of this.segments) {
      seg.position.z += ds
      const trailingEdgeZ = seg.position.z - TUNNEL_SEGMENT_LENGTH / 2
      if (trailingEdgeZ > RECYCLE_Z) {
        seg.position.z -= this.chainLength
      }
    }
  }
}
