import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'
import type { Renderer } from '../Renderer'

const DUST_COUNT = 250
const X_RANGE = 1.4
const Y_MIN = -0.1
const Y_MAX = 3.0
const Z_MIN = -28
const Z_MAX = RECYCLE_Z
const FALL_SPEED_MIN = 0.15
const FALL_SPEED_MAX = 0.45
const POINT_SIZE = 0.022
const POINT_COLOR = 0x5a4a36

function createDustTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class DustRenderer implements Renderer {
  readonly object3D: THREE.Points
  private readonly fallSpeeds: Float32Array
  private readonly positions: Float32Array
  private readonly positionAttr: THREE.BufferAttribute
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.PointsMaterial
  private readonly texture: THREE.Texture

  constructor() {
    this.geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(DUST_COUNT * 3)
    const fallSpeeds = new Float32Array(DUST_COUNT)

    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * X_RANGE
      positions[i * 3 + 1] = Y_MIN + Math.random() * (Y_MAX - Y_MIN)
      positions[i * 3 + 2] = Z_MIN + Math.random() * (Z_MAX - Z_MIN)
      fallSpeeds[i] = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
    }

    this.positionAttr = new THREE.BufferAttribute(positions, 3)
    this.positionAttr.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', this.positionAttr)

    this.texture = createDustTexture()
    this.material = new THREE.PointsMaterial({
      color: POINT_COLOR,
      size: POINT_SIZE,
      sizeAttenuation: true,
      map: this.texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    })

    this.object3D = new THREE.Points(this.geometry, this.material)
    this.object3D.frustumCulled = false
    this.fallSpeeds = fallSpeeds
    this.positions = positions
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    const ds = FORWARD_SPEED * dt
    const positions = this.positions
    const fallSpeeds = this.fallSpeeds
    const ySpan = Y_MAX - Y_MIN
    const zSpan = Z_MAX - Z_MIN

    for (let i = 0; i < DUST_COUNT; i++) {
      const ix = i * 3
      const iy = ix + 1
      const iz = ix + 2

      positions[iy] -= fallSpeeds[i] * dt
      positions[iz] += ds

      if (positions[iz] > Z_MAX) {
        positions[ix] = (Math.random() * 2 - 1) * X_RANGE
        positions[iy] = Y_MIN + Math.random() * ySpan
        positions[iz] -= zSpan
      } else if (positions[iy] < Y_MIN) {
        positions[ix] = (Math.random() * 2 - 1) * X_RANGE
        positions[iy] = Y_MAX
      }
    }

    this.positionAttr.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.object3D.removeFromParent()
  }
}
