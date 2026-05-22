import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../../core/constants'
import { createRockTextures } from '../../textures/procedural'
import type { Renderer } from '../Renderer'
import {
  TUNNEL_CENTER_Y,
  TUNNEL_RADIAL_SEGMENTS,
  TUNNEL_RADIUS,
  TUNNEL_SEGMENT_COUNT,
  TUNNEL_SEGMENT_LENGTH,
} from './dimensions'
import { TunnelSegmentRenderer } from './TunnelSegmentRenderer'

const CLIP_DISABLED = 10000

export class TunnelRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly segments: TunnelSegmentRenderer[] = []
  private readonly chainLength = TUNNEL_SEGMENT_LENGTH * TUNNEL_SEGMENT_COUNT
  private readonly clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), CLIP_DISABLED)
  private readonly geometry: THREE.CylinderGeometry
  private readonly material: THREE.MeshStandardMaterial
  private readonly rockTextures: ReturnType<typeof createRockTextures>

  constructor() {
    this.geometry = new THREE.CylinderGeometry(
      TUNNEL_RADIUS,
      TUNNEL_RADIUS,
      TUNNEL_SEGMENT_LENGTH,
      TUNNEL_RADIAL_SEGMENTS,
      1,
      true,
    )
    this.geometry.rotateX(Math.PI / 2)

    this.rockTextures = createRockTextures(6, 50)
    this.material = new THREE.MeshStandardMaterial({
      map: this.rockTextures.map,
      bumpMap: this.rockTextures.bumpMap,
      bumpScale: 0.6,
      roughness: 0.95,
      side: THREE.BackSide,
      clippingPlanes: [this.clipPlane],
    })

    for (let i = 0; i < TUNNEL_SEGMENT_COUNT; i++) {
      const segment = new TunnelSegmentRenderer(
        this.geometry,
        this.material,
        TUNNEL_CENTER_Y,
        -TUNNEL_SEGMENT_LENGTH / 2 - i * TUNNEL_SEGMENT_LENGTH,
      )
      segment.mount(this.object3D)
      this.segments.push(segment)
    }
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  setBranchClip(z: number): void {
    this.clipPlane.constant = -z
  }

  clearBranchClip(): void {
    this.clipPlane.constant = CLIP_DISABLED
  }

  update(dt: number): void {
    const ds = FORWARD_SPEED * dt
    for (const seg of this.segments) {
      let z = seg.getPositionZ() + ds
      if (z - TUNNEL_SEGMENT_LENGTH / 2 > RECYCLE_Z) z -= this.chainLength
      seg.setPositionZ(z)
    }
  }

  dispose(): void {
    for (const seg of this.segments) seg.dispose()
    this.segments.length = 0
    this.geometry.dispose()
    this.material.dispose()
    this.rockTextures.map.dispose()
    this.rockTextures.bumpMap.dispose()
    this.object3D.removeFromParent()
  }
}
