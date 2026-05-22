import * as THREE from 'three'
import { BRANCH_LENGTH, BRANCH_OFFSET } from '../constants'
import { createMetalTextures, createRockTextures } from '../../textures/procedural'
import type { Renderer } from '../Renderer'
import {
  RAIL_GAUGE,
  RAIL_HEIGHT,
  RAIL_WIDTH,
  TIE_HEIGHT,
  TUNNEL_CENTER_Y,
  TUNNEL_RADIUS,
} from './dimensions'

const RADIAL = 64
const LONGITUDINAL = 32

const railY = TIE_HEIGHT + RAIL_HEIGHT / 2

function createTiltedRail(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
): { mesh: THREE.Mesh; geometry: THREE.BoxGeometry } {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)
  const geometry = new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, length)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set((start.x + end.x) / 2, railY, (start.z + end.z) / 2)
  mesh.rotation.y = angle
  return { mesh, geometry }
}

function peanutBoundary(s: number, d: number, R: number): { x: number; y: number } {
  if (d < 1e-6) {
    const a = Math.PI / 2 + 2 * Math.PI * s
    return { x: R * Math.cos(a), y: R * Math.sin(a) }
  }
  const alpha = Math.acos(d / R)
  if (s < 0.5) {
    const t = s * 2
    const psi = alpha + t * (2 * Math.PI - 2 * alpha)
    return { x: -d + R * Math.cos(psi), y: R * Math.sin(psi) }
  }
  const t = (s - 0.5) * 2
  const phi = Math.PI + alpha + t * (2 * Math.PI - 2 * alpha)
  return { x: d + R * Math.cos(phi), y: R * Math.sin(phi) }
}

function buildBranchTunnelGeometry(
  R: number,
  offsetMax: number,
  length: number,
  radial: number,
  longitudinal: number,
): THREE.BufferGeometry {
  const verts: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let j = 0; j <= longitudinal; j++) {
    const v = j / longitudinal
    const d = offsetMax * v
    const z = -length * v
    for (let i = 0; i <= radial; i++) {
      const s = i / radial
      const p = peanutBoundary(s, d, R)
      verts.push(p.x, TUNNEL_CENTER_Y + p.y, z)
      uvs.push(s, v)
    }
  }

  const rowSize = radial + 1
  for (let j = 0; j < longitudinal; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * rowSize + i
      const b = a + 1
      const c = (j + 1) * rowSize + i
      const dd = c + 1
      indices.push(a, c, b)
      indices.push(b, c, dd)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}

export class BranchRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly railTextures: ReturnType<typeof createMetalTextures>
  private readonly rockTextures: ReturnType<typeof createRockTextures>

  constructor() {
    this.railTextures = createMetalTextures(1, 3)
    const railMaterial = new THREE.MeshStandardMaterial({
      map: this.railTextures.map,
      bumpMap: this.railTextures.bumpMap,
      bumpScale: 0.005,
      metalness: 0.6,
      roughness: 0.5,
    })
    this.materials.push(railMaterial)

    const half = RAIL_GAUGE / 2
    const lines: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(-half, 0, 0), new THREE.Vector3(-BRANCH_OFFSET - half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(+half, 0, 0), new THREE.Vector3(-BRANCH_OFFSET + half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(-half, 0, 0), new THREE.Vector3(+BRANCH_OFFSET - half, 0, -BRANCH_LENGTH)],
      [new THREE.Vector3(+half, 0, 0), new THREE.Vector3(+BRANCH_OFFSET + half, 0, -BRANCH_LENGTH)],
    ]
    for (const [start, end] of lines) {
      const { mesh, geometry } = createTiltedRail(start, end, railMaterial)
      this.object3D.add(mesh)
      this.geometries.push(geometry)
    }

    const tunnelGeom = buildBranchTunnelGeometry(
      TUNNEL_RADIUS,
      BRANCH_OFFSET,
      BRANCH_LENGTH,
      RADIAL,
      LONGITUDINAL,
    )
    this.geometries.push(tunnelGeom)

    this.rockTextures = createRockTextures(6, 5)
    const tunnelMaterial = new THREE.MeshStandardMaterial({
      map: this.rockTextures.map,
      bumpMap: this.rockTextures.bumpMap,
      bumpScale: 0.6,
      roughness: 0.95,
      side: THREE.BackSide,
    })
    this.materials.push(tunnelMaterial)

    const tunnelMesh = new THREE.Mesh(tunnelGeom, tunnelMaterial)
    this.object3D.add(tunnelMesh)

    this.object3D.visible = false
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(): void {}

  show(x: number, z: number): void {
    this.object3D.position.x = x
    this.object3D.position.z = z
    this.object3D.visible = true
  }

  hide(): void {
    this.object3D.visible = false
  }

  isVisible(): boolean {
    return this.object3D.visible
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    for (const m of this.materials) m.dispose()
    this.materials.length = 0
    this.railTextures.map.dispose()
    this.railTextures.bumpMap.dispose()
    this.rockTextures.map.dispose()
    this.rockTextures.bumpMap.dispose()
    this.object3D.removeFromParent()
  }
}
