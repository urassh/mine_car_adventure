import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import { createMetalTextures } from '../textures/procedural'
import { TIE_HEIGHT } from './Ties'

// レール 1 本の寸法とチェーン構成
const RAIL_GAUGE = 1.0 // 左右レールの間隔
const RAIL_WIDTH = 0.08
const RAIL_HEIGHT = 0.08
const RAIL_SEGMENT_LENGTH = 100 // 1 セグメントの長さ
const RAIL_SEGMENT_COUNT = 2 // 片側あたりのセグメント数 (>=2 でリサイクル可)

// 左右 2 本のレール。長いセグメントを N 個チェーンさせて、
// カメラを通り過ぎたら奥に付け足してループする。
export class Rails extends THREE.Group {
  private readonly segments: THREE.Mesh[] = []
  private readonly chainLength: number

  constructor() {
    super()

    this.chainLength = RAIL_SEGMENT_LENGTH * RAIL_SEGMENT_COUNT

    const geometry = new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, RAIL_SEGMENT_LENGTH)
    // セグメント長 100m。レール長方向に 50 タイル (= 2m/タイル) で擦れ模様を流す。
    const { map, bumpMap } = createMetalTextures(1, 50)
    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.005,
      metalness: 0.6,
      roughness: 0.5,
    })

    const railY = TIE_HEIGHT + RAIL_HEIGHT / 2 // 枕木の上に乗る高さ

    for (const side of [-1, 1]) {
      const x = (side * RAIL_GAUGE) / 2
      for (let i = 0; i < RAIL_SEGMENT_COUNT; i++) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, railY, -RAIL_SEGMENT_LENGTH / 2 - i * RAIL_SEGMENT_LENGTH)
        this.add(mesh)
        this.segments.push(mesh)
      }
    }
  }

  update(dt: number) {
    const ds = FORWARD_SPEED * dt
    for (const seg of this.segments) {
      seg.position.z += ds
      // セグメント全体がカメラ後方に抜けたら、チェーン分まとめて奥へ戻す
      const trailingEdgeZ = seg.position.z - RAIL_SEGMENT_LENGTH / 2
      if (trailingEdgeZ > RECYCLE_Z) {
        seg.position.z -= this.chainLength
      }
    }
  }
}
