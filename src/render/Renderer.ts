import * as THREE from 'three'

export interface Renderer {
  readonly object3D: THREE.Object3D
  mount(parent: THREE.Object3D): void
  update(dt: number): void
  dispose(): void
}
