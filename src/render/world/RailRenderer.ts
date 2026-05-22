import * as THREE from 'three'
import type { Renderer } from '../Renderer'

export class RailRenderer implements Renderer {
  readonly object3D: THREE.Mesh

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    this.object3D = new THREE.Mesh(geometry, material)
    this.object3D.position.set(x, y, z)
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
