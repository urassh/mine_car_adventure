import * as THREE from 'three'
import { createWoodTextures } from '../../textures/procedural'
import type { Renderer } from '../Renderer'

const INNER_WIDTH = 0.78
const INNER_LENGTH = 1.3
const RIM_THICKNESS = 0.11
const RIM_HEIGHT = 0.16
const RIM_TOP_Y = -0.42
const INNER_PANEL_HEIGHT = 0.35
const INNER_PANEL_THICKNESS = 0.04
const CORNER_POST_HEIGHT = 0.5
const CORNER_POST_THICKNESS = 0.16
const RIM_CENTER_Y = RIM_TOP_Y - RIM_HEIGHT / 2

const INNER_LIGHT_COLOR = 0xffaa66
const INNER_LIGHT_INTENSITY = 0.7
const INNER_LIGHT_DISTANCE = 2.2
const INNER_LIGHT_DECAY = 2
const INNER_LIGHT_Y = RIM_TOP_Y - RIM_HEIGHT - 0.2

const TILT_LERP = 8

export class CartRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly geometries: THREE.BoxGeometry[] = []
  private readonly material: THREE.MeshStandardMaterial
  private readonly woodTextures: ReturnType<typeof createWoodTextures>
  private targetTilt = 0
  private currentTilt = 0

  constructor() {
    this.woodTextures = createWoodTextures(2, 2)
    this.material = new THREE.MeshStandardMaterial({
      map: this.woodTextures.map,
      bumpMap: this.woodTextures.bumpMap,
      bumpScale: 0.01,
      roughness: 0.95,
      emissive: 0x1a0a02,
      emissiveIntensity: 0.8,
    })

    const outerWidth = INNER_WIDTH + RIM_THICKNESS * 2
    const outerLength = INNER_LENGTH + RIM_THICKNESS * 2

    const longRimGeom = new THREE.BoxGeometry(outerWidth, RIM_HEIGHT, RIM_THICKNESS)
    const sideRimGeom = new THREE.BoxGeometry(RIM_THICKNESS, RIM_HEIGHT, INNER_LENGTH)
    const longPanelGeom = new THREE.BoxGeometry(INNER_WIDTH, INNER_PANEL_HEIGHT, INNER_PANEL_THICKNESS)
    const sidePanelGeom = new THREE.BoxGeometry(INNER_PANEL_THICKNESS, INNER_PANEL_HEIGHT, INNER_LENGTH)
    const postGeom = new THREE.BoxGeometry(CORNER_POST_THICKNESS, CORNER_POST_HEIGHT, CORNER_POST_THICKNESS)
    this.geometries.push(longRimGeom, sideRimGeom, longPanelGeom, sidePanelGeom, postGeom)

    const front = new THREE.Mesh(longRimGeom, this.material)
    front.position.set(0, RIM_CENTER_Y, -(INNER_LENGTH / 2 + RIM_THICKNESS / 2))
    this.object3D.add(front)

    const back = new THREE.Mesh(longRimGeom, this.material)
    back.position.set(0, RIM_CENTER_Y, +(INNER_LENGTH / 2 + RIM_THICKNESS / 2))
    this.object3D.add(back)

    const left = new THREE.Mesh(sideRimGeom, this.material)
    left.position.set(-(INNER_WIDTH / 2 + RIM_THICKNESS / 2), RIM_CENTER_Y, 0)
    this.object3D.add(left)

    const right = new THREE.Mesh(sideRimGeom, this.material)
    right.position.set(+(INNER_WIDTH / 2 + RIM_THICKNESS / 2), RIM_CENTER_Y, 0)
    this.object3D.add(right)

    const panelCenterY = RIM_TOP_Y - RIM_HEIGHT - INNER_PANEL_HEIGHT / 2

    const frontPanel = new THREE.Mesh(longPanelGeom, this.material)
    frontPanel.position.set(0, panelCenterY, -INNER_LENGTH / 2 + INNER_PANEL_THICKNESS / 2)
    this.object3D.add(frontPanel)
    const backPanel = new THREE.Mesh(longPanelGeom, this.material)
    backPanel.position.set(0, panelCenterY, +INNER_LENGTH / 2 - INNER_PANEL_THICKNESS / 2)
    this.object3D.add(backPanel)

    const leftPanel = new THREE.Mesh(sidePanelGeom, this.material)
    leftPanel.position.set(-INNER_WIDTH / 2 + INNER_PANEL_THICKNESS / 2, panelCenterY, 0)
    this.object3D.add(leftPanel)
    const rightPanel = new THREE.Mesh(sidePanelGeom, this.material)
    rightPanel.position.set(+INNER_WIDTH / 2 - INNER_PANEL_THICKNESS / 2, panelCenterY, 0)
    this.object3D.add(rightPanel)

    const postCenterY = RIM_TOP_Y - RIM_HEIGHT - CORNER_POST_HEIGHT / 2
    const postX = outerWidth / 2 - CORNER_POST_THICKNESS / 2
    const postZ = outerLength / 2 - CORNER_POST_THICKNESS / 2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeom, this.material)
        post.position.set(sx * postX, postCenterY, sz * postZ)
        this.object3D.add(post)
      }
    }

    const innerLight = new THREE.PointLight(
      INNER_LIGHT_COLOR,
      INNER_LIGHT_INTENSITY,
      INNER_LIGHT_DISTANCE,
      INNER_LIGHT_DECAY,
    )
    innerLight.position.set(0, INNER_LIGHT_Y, 0)
    this.object3D.add(innerLight)
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  tilt(angle: number): void {
    this.targetTilt = angle
  }

  resetOrientation(): void {
    this.targetTilt = 0
  }

  update(dt: number): void {
    this.currentTilt += (this.targetTilt - this.currentTilt) * (1 - Math.exp(-TILT_LERP * dt))
    this.object3D.rotation.z = this.currentTilt
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    this.material.dispose()
    this.woodTextures.map.dispose()
    this.woodTextures.bumpMap.dispose()
    this.object3D.removeFromParent()
  }
}
