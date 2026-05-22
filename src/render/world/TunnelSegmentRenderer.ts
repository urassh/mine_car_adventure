import * as THREE from 'three'
import type { Renderer } from '../Renderer'

export class TunnelSegmentRenderer implements Renderer {
  readonly object3D: THREE.Mesh

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z: number) {
    this.object3D = new THREE.Mesh(geometry, material)
    this.object3D.position.set(0, y, z)
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(): void {}

  setPositionZ(z: number): void {
    this.object3D.position.z = z
  }

  getPositionZ(): number {
    return this.object3D.position.z
  }

  dispose(): void {
    this.object3D.removeFromParent()
  }
}
