import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../../core/constants'
import { createWoodTextures } from '../../textures/procedural'
import type { Renderer } from '../Renderer'
import { TIE_COUNT, TIE_HEIGHT, TIE_LENGTH, TIE_SPACING, TIE_WIDTH } from './dimensions'
import { TieRenderer } from './TieRenderer'

export class TieFieldRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly ties: TieRenderer[] = []
  private readonly chainLength = TIE_SPACING * TIE_COUNT
  private readonly geometry: THREE.BoxGeometry
  private readonly material: THREE.MeshStandardMaterial
  private readonly woodTextures: ReturnType<typeof createWoodTextures>

  constructor() {
    this.geometry = new THREE.BoxGeometry(TIE_LENGTH, TIE_HEIGHT, TIE_WIDTH)
    this.woodTextures = createWoodTextures(8, 1)
    this.material = new THREE.MeshStandardMaterial({
      map: this.woodTextures.map,
      bumpMap: this.woodTextures.bumpMap,
      bumpScale: 0.02,
      roughness: 0.95,
    })

    for (let i = 0; i < TIE_COUNT; i++) {
      const tie = new TieRenderer(this.geometry, this.material, TIE_HEIGHT / 2, -TIE_SPACING * i)
      tie.mount(this.object3D)
      this.ties.push(tie)
    }
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    const ds = FORWARD_SPEED * dt
    for (const tie of this.ties) {
      let z = tie.getPositionZ() + ds
      if (z > RECYCLE_Z) z -= this.chainLength
      tie.setPositionZ(z)
    }
  }

  dispose(): void {
    for (const tie of this.ties) tie.dispose()
    this.ties.length = 0
    this.geometry.dispose()
    this.material.dispose()
    this.woodTextures.map.dispose()
    this.woodTextures.bumpMap.dispose()
    this.object3D.removeFromParent()
  }
}
