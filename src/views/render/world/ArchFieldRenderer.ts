import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import { createWoodTextures } from '../../textures/procedural'
import type { Renderer } from '../Renderer'
import { ARCH_COUNT, ARCH_SPACING } from './dimensions'
import { ArchRenderer } from './ArchRenderer'

export class ArchFieldRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly arches: ArchRenderer[] = []
  private readonly chainLength = ARCH_SPACING * ARCH_COUNT
  private readonly material: THREE.MeshStandardMaterial
  private readonly woodTextures: ReturnType<typeof createWoodTextures>

  constructor() {
    this.woodTextures = createWoodTextures(1, 2)
    this.material = new THREE.MeshStandardMaterial({
      map: this.woodTextures.map,
      bumpMap: this.woodTextures.bumpMap,
      bumpScale: 0.02,
      roughness: 0.95,
    })

    for (let i = 0; i < ARCH_COUNT; i++) {
      const arch = new ArchRenderer(this.material, -ARCH_SPACING * i)
      arch.mount(this.object3D)
      this.arches.push(arch)
    }
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    const ds = FORWARD_SPEED * dt
    for (const arch of this.arches) {
      let z = arch.getPositionZ() + ds
      if (z > RECYCLE_Z) z -= this.chainLength
      arch.setPositionZ(z)
    }
  }

  dispose(): void {
    for (const arch of this.arches) arch.dispose()
    this.arches.length = 0
    this.material.dispose()
    this.woodTextures.map.dispose()
    this.woodTextures.bumpMap.dispose()
    this.object3D.removeFromParent()
  }
}
