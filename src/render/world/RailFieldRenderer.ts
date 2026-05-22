import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../../core/constants'
import { createMetalTextures } from '../../textures/procedural'
import type { Renderer } from '../Renderer'
import {
  RAIL_GAUGE,
  RAIL_HEIGHT,
  RAIL_SEGMENT_COUNT,
  RAIL_SEGMENT_LENGTH,
  RAIL_WIDTH,
  TIE_HEIGHT,
} from './dimensions'
import { RailRenderer } from './RailRenderer'

export class RailFieldRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly rails: RailRenderer[] = []
  private readonly chainLength = RAIL_SEGMENT_LENGTH * RAIL_SEGMENT_COUNT
  private readonly geometry: THREE.BoxGeometry
  private readonly material: THREE.MeshStandardMaterial
  private readonly metalTextures: ReturnType<typeof createMetalTextures>

  constructor() {
    this.geometry = new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, RAIL_SEGMENT_LENGTH)
    this.metalTextures = createMetalTextures(1, 50)
    this.material = new THREE.MeshStandardMaterial({
      map: this.metalTextures.map,
      bumpMap: this.metalTextures.bumpMap,
      bumpScale: 0.005,
      metalness: 0.6,
      roughness: 0.5,
    })

    const railY = TIE_HEIGHT + RAIL_HEIGHT / 2
    for (const side of [-1, 1] as const) {
      const x = (side * RAIL_GAUGE) / 2
      for (let i = 0; i < RAIL_SEGMENT_COUNT; i++) {
        const rail = new RailRenderer(
          this.geometry,
          this.material,
          x,
          railY,
          -RAIL_SEGMENT_LENGTH / 2 - i * RAIL_SEGMENT_LENGTH,
        )
        rail.mount(this.object3D)
        this.rails.push(rail)
      }
    }
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    const ds = FORWARD_SPEED * dt
    for (const rail of this.rails) {
      let z = rail.getPositionZ() + ds
      if (z - RAIL_SEGMENT_LENGTH / 2 > RECYCLE_Z) {
        z -= this.chainLength
      }
      rail.setPositionZ(z)
    }
  }

  dispose(): void {
    for (const rail of this.rails) rail.dispose()
    this.rails.length = 0
    this.geometry.dispose()
    this.material.dispose()
    this.metalTextures.map.dispose()
    this.metalTextures.bumpMap.dispose()
    this.object3D.removeFromParent()
  }
}
