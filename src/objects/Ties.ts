import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import { createWoodTextures } from '../textures/procedural'

// 枕木の寸法・配置 (他オブジェクトから参照される可能性があるので export)
export const TIE_LENGTH = 1.6 // レールに直交する方向の長さ (X 方向)
export const TIE_WIDTH = 0.2 // 進行方向の厚み (Z 方向)
export const TIE_HEIGHT = 0.1
export const TIE_SPACING = 0.6 // 枕木の間隔
export const TIE_COUNT = 200 // プール内の枕木総数

// 等間隔に並ぶ枕木。カメラ後方に抜けたものを奥側に付け替えてループ。
export class Ties extends THREE.Group {
  private readonly ties: THREE.Mesh[] = []
  private readonly chainLength: number

  constructor() {
    super()

    this.chainLength = TIE_SPACING * TIE_COUNT

    const geometry = new THREE.BoxGeometry(TIE_LENGTH, TIE_HEIGHT, TIE_WIDTH)
    // 枕木は長辺 1.6m。長辺方向に 8 タイル並べる (≒ 0.2m/タイル) と木目が密に見える。
    const { map, bumpMap } = createWoodTextures(8, 1)
    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.02,
      roughness: 0.95,
    })

    for (let i = 0; i < TIE_COUNT; i++) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(0, TIE_HEIGHT / 2, -TIE_SPACING * i)
      this.add(mesh)
      this.ties.push(mesh)
    }
  }

  update(dt: number) {
    const ds = FORWARD_SPEED * dt
    for (const tie of this.ties) {
      tie.position.z += ds
      if (tie.position.z > RECYCLE_Z) {
        tie.position.z -= this.chainLength
      }
    }
  }
}
