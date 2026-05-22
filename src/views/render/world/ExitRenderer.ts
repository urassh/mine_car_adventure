import * as THREE from 'three'
import type { Renderer } from '../Renderer'
import { TUNNEL_CENTER_Y, TUNNEL_RADIUS } from './dimensions'

const RING_INNER = TUNNEL_RADIUS * 0.78
const RING_OUTER = TUNNEL_RADIUS * 1.05
const DISC_RADIUS = RING_INNER

export class ExitRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly light: THREE.PointLight
  private elapsed = 0

  constructor() {
    const ringGeom = new THREE.RingGeometry(RING_INNER, RING_OUTER, 96)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe48a,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeom, ringMat)
    ring.position.y = TUNNEL_CENTER_Y
    this.object3D.add(ring)
    this.geometries.push(ringGeom)
    this.materials.push(ringMat)

    const discGeom = new THREE.CircleGeometry(DISC_RADIUS, 96)
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xfff6d0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const disc = new THREE.Mesh(discGeom, discMat)
    disc.position.y = TUNNEL_CENTER_Y
    this.object3D.add(disc)
    this.geometries.push(discGeom)
    this.materials.push(discMat)

    this.light = new THREE.PointLight(0xfff0b8, 12, 40, 1.5)
    this.light.position.set(0, TUNNEL_CENTER_Y, 0)
    this.object3D.add(this.light)

    this.object3D.visible = false
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    if (!this.object3D.visible) return
    this.elapsed += dt
    const pulse = 1 + Math.sin(this.elapsed * 4) * 0.08
    this.object3D.scale.set(pulse, pulse, 1)
    this.light.intensity = 10 + Math.sin(this.elapsed * 4) * 3
  }

  show(x: number, z: number): void {
    this.object3D.position.x = x
    this.object3D.position.z = z
    this.object3D.visible = true
  }

  hide(): void {
    this.object3D.visible = false
    this.elapsed = 0
    this.object3D.scale.set(1, 1, 1)
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    for (const m of this.materials) m.dispose()
    this.materials.length = 0
    this.object3D.removeFromParent()
  }
}
