import type { CameraRig } from '../camera/CameraRig'
import type { Renderer } from '../Renderer'
import type { CartRenderer } from '../world/CartRenderer'

export class PlayerRenderer {
  private readonly cameraRig: CameraRig
  private readonly cart: CartRenderer
  private readonly scenery: Renderer[]

  constructor(cameraRig: CameraRig, cart: CartRenderer, scenery: Renderer[]) {
    this.cameraRig = cameraRig
    this.cart = cart
    this.scenery = scenery
    this.cart.mount(this.cameraRig.camera)
  }

  setLateral(x: number): void {
    this.cameraRig.setLateral(x)
    for (const s of this.scenery) {
      s.object3D.position.x = x
    }
  }

  getLateral(): number {
    return this.cameraRig.getLateral()
  }

  tilt(angle: number): void {
    this.cart.tilt(angle)
  }

  resetOrientation(): void {
    this.cart.resetOrientation()
  }

  update(dt: number, timeMs: number): void {
    this.cameraRig.update(dt, timeMs)
    this.cart.update(dt)
  }

  dispose(): void {
    this.cart.dispose()
  }
}
