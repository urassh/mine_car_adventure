import * as THREE from 'three'

const HEIGHT = 1.4
const LOOK_AHEAD = 10
const TILT_LERP = 8

const SHAKE_AMP_X = 0.028
const SHAKE_AMP_Y = 0.018
const SHAKE_FREQ_X = 1.7
const SHAKE_FREQ_Y = 2.3
const TWO_PI = Math.PI * 2

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  private lateral = 0
  private targetTilt = 0
  private currentTilt = 0

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.set(0, HEIGHT, 0)
    this.camera.lookAt(0, HEIGHT, -LOOK_AHEAD)
  }

  setLateral(x: number): void {
    this.lateral = x
  }

  getLateral(): number {
    return this.lateral
  }

  tilt(angle: number): void {
    this.targetTilt = angle
  }

  resetOrientation(): void {
    this.targetTilt = 0
  }

  update(dt: number, timeMs: number): void {
    this.currentTilt += (this.targetTilt - this.currentTilt) * (1 - Math.exp(-TILT_LERP * dt))

    const t = timeMs / 1000
    const shakeX =
      Math.sin(t * SHAKE_FREQ_X * TWO_PI) * SHAKE_AMP_X +
      Math.sin(t * SHAKE_FREQ_X * 1.7 * TWO_PI + 1.3) * SHAKE_AMP_X * 0.4
    const shakeY =
      Math.sin(t * SHAKE_FREQ_Y * TWO_PI + 0.7) * SHAKE_AMP_Y +
      Math.cos(t * SHAKE_FREQ_Y * 1.3 * TWO_PI) * SHAKE_AMP_Y * 0.5

    this.camera.position.x = this.lateral + shakeX
    this.camera.position.y = HEIGHT + shakeY
    this.camera.rotation.z = this.currentTilt
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }
}
