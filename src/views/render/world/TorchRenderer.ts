import * as THREE from 'three'
import type { Renderer } from '../Renderer'
import { postCenterXAt, WOOD_THICKNESS } from './dimensions'

const HANDLE_LENGTH = 0.28
const HANDLE_RADIUS = 0.024
const WRAP_LENGTH = 0.1
const WRAP_RADIUS = 0.044
const FLAME_HEIGHT = 0.18
const FLAME_RADIUS = 0.055

export const TORCH_COLOR = 0xffaa55
const TORCH_BASE_INTENSITY = 2.4
const TORCH_DISTANCE = 9
const TORCH_DECAY = 2

const FLICKER_AMPLITUDE = 0.3
const FLAME_FLICKER = 0.2
const RESAMPLE_MIN = 0.04
const RESAMPLE_MAX = 0.18
const FOLLOW_RATE = 18

const sampleTarget = () => Math.random() * 2 - 1
const sampleInterval = () => RESAMPLE_MIN + Math.random() * (RESAMPLE_MAX - RESAMPLE_MIN)

export type TorchSharedAssets = {
  handleGeometry: THREE.CylinderGeometry
  wrapGeometry: THREE.CylinderGeometry
  flameGeometry: THREE.ConeGeometry
  handleMaterial: THREE.Material
  wrapMaterial: THREE.Material
  flameMaterial: THREE.Material
}

export function createTorchSharedAssets(): TorchSharedAssets {
  const handleGeometry = new THREE.CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 8)
  handleGeometry.rotateZ(Math.PI / 2)
  const wrapGeometry = new THREE.CylinderGeometry(WRAP_RADIUS, WRAP_RADIUS * 0.85, WRAP_LENGTH, 10)
  wrapGeometry.rotateZ(Math.PI / 2)
  const flameGeometry = new THREE.ConeGeometry(FLAME_RADIUS, FLAME_HEIGHT, 8)
  const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.9 })
  const wrapMaterial = new THREE.MeshStandardMaterial({ color: 0x140a04, roughness: 0.95 })
  const flameMaterial = new THREE.MeshBasicMaterial({ color: TORCH_COLOR })
  return { handleGeometry, wrapGeometry, flameGeometry, handleMaterial, wrapMaterial, flameMaterial }
}

export function disposeTorchSharedAssets(a: TorchSharedAssets): void {
  a.handleGeometry.dispose()
  a.wrapGeometry.dispose()
  a.flameGeometry.dispose()
  a.handleMaterial.dispose()
  a.wrapMaterial.dispose()
  a.flameMaterial.dispose()
}

export class TorchRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly flame: THREE.Mesh
  private readonly light: THREE.PointLight
  private noise = 0
  private target = sampleTarget()
  private resampleTimer = sampleInterval()

  constructor(assets: TorchSharedAssets, side: 1 | -1, x: number, y: number, z: number) {
    this.object3D.position.set(x, y, z)
    const dir = -side

    const handle = new THREE.Mesh(assets.handleGeometry, assets.handleMaterial)
    handle.position.set((dir * HANDLE_LENGTH) / 2, 0, 0)
    this.object3D.add(handle)

    const wrapX = dir * (HANDLE_LENGTH - WRAP_LENGTH / 2)
    const wrap = new THREE.Mesh(assets.wrapGeometry, assets.wrapMaterial)
    wrap.position.set(wrapX, 0, 0)
    this.object3D.add(wrap)

    const flameY = WRAP_RADIUS + FLAME_HEIGHT / 2
    this.flame = new THREE.Mesh(assets.flameGeometry, assets.flameMaterial)
    this.flame.position.set(wrapX, flameY, 0)
    this.object3D.add(this.flame)

    this.light = new THREE.PointLight(TORCH_COLOR, TORCH_BASE_INTENSITY, TORCH_DISTANCE, TORCH_DECAY)
    this.light.position.set(wrapX, flameY, 0)
    this.object3D.add(this.light)
  }

  static computeMountX(side: 1 | -1, y: number): number {
    return side * (postCenterXAt(y) - WOOD_THICKNESS / 2)
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    const followAlpha = 1 - Math.exp(-FOLLOW_RATE * dt)
    this.resampleTimer -= dt
    if (this.resampleTimer <= 0) {
      this.target = sampleTarget()
      this.resampleTimer = sampleInterval()
    }
    this.noise += (this.target - this.noise) * followAlpha
    this.light.intensity = TORCH_BASE_INTENSITY * (1 + FLICKER_AMPLITUDE * this.noise)
    this.flame.scale.y = 1 + FLAME_FLICKER * this.noise
  }

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
