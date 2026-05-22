import * as THREE from 'three'
import type { Renderer } from '../Renderer'
import { APEX_Y, POST_BOTTOM_X, POST_BOTTOM_Y, POST_TOP_X, POST_TOP_Y, WOOD_THICKNESS } from './dimensions'

const WOOD_THICKNESS_JITTER = 0.03
const POST_BOTTOM_X_JITTER = 0.02
const POST_TOP_X_JITTER = 0.05
const POST_TOP_Y_JITTER = 0.1
const APEX_Y_JITTER = 0.15
const LEAN_X_JITTER = 0.03
const ROLL_Z_JITTER = 0.02

const jitter = (amount: number) => (Math.random() * 2 - 1) * amount

export class ArchRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly geometries: THREE.BoxGeometry[] = []

  constructor(material: THREE.Material, z: number) {
    const woodThickness = WOOD_THICKNESS + jitter(WOOD_THICKNESS_JITTER)
    const postBottomX = POST_BOTTOM_X + jitter(POST_BOTTOM_X_JITTER)
    const postTopX = POST_TOP_X + jitter(POST_TOP_X_JITTER)
    const postTopY = POST_TOP_Y + jitter(POST_TOP_Y_JITTER)
    const apexY = APEX_Y + jitter(APEX_Y_JITTER)

    const postLength = Math.hypot(postBottomX - postTopX, postTopY - POST_BOTTOM_Y)
    const postTilt = Math.atan2(postBottomX - postTopX, postTopY - POST_BOTTOM_Y)
    const postCenterX = (postBottomX + postTopX) / 2
    const postCenterY = (POST_BOTTOM_Y + postTopY) / 2

    const roofLength = Math.hypot(postTopX, apexY - postTopY)
    const roofTilt = Math.atan2(postTopX, apexY - postTopY)
    const roofCenterX = postTopX / 2
    const roofCenterY = (postTopY + apexY) / 2

    const postGeometry = new THREE.BoxGeometry(woodThickness, postLength, woodThickness)
    const roofGeometry = new THREE.BoxGeometry(woodThickness, roofLength, woodThickness)
    this.geometries.push(postGeometry, roofGeometry)

    const leftPost = new THREE.Mesh(postGeometry, material)
    leftPost.position.set(-postCenterX, postCenterY, 0)
    leftPost.rotation.z = -postTilt
    this.object3D.add(leftPost)

    const rightPost = new THREE.Mesh(postGeometry, material)
    rightPost.position.set(postCenterX, postCenterY, 0)
    rightPost.rotation.z = postTilt
    this.object3D.add(rightPost)

    const leftRoof = new THREE.Mesh(roofGeometry, material)
    leftRoof.position.set(-roofCenterX, roofCenterY, 0)
    leftRoof.rotation.z = -roofTilt
    this.object3D.add(leftRoof)

    const rightRoof = new THREE.Mesh(roofGeometry, material)
    rightRoof.position.set(roofCenterX, roofCenterY, 0)
    rightRoof.rotation.z = roofTilt
    this.object3D.add(rightRoof)

    this.object3D.rotation.x = jitter(LEAN_X_JITTER)
    this.object3D.rotation.z = jitter(ROLL_Z_JITTER)
    this.object3D.position.z = z
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
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    this.object3D.removeFromParent()
  }
}
