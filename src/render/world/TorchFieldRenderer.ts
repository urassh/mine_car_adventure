import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../../core/constants'
import type { Renderer } from '../Renderer'
import { ARCH_SPACING } from './dimensions'
import {
  createTorchSharedAssets,
  disposeTorchSharedAssets,
  TorchRenderer,
  type TorchSharedAssets,
} from './TorchRenderer'

const TORCH_COUNT = 16
const SPACING_CHOICES = [ARCH_SPACING, ARCH_SPACING * 2, ARCH_SPACING * 2, ARCH_SPACING * 3]
const TORCH_Y = 1.6
const HEIGHT_JITTER = 0.25
const MAX_SAME_SIDE_RUN = 2

export class TorchFieldRenderer implements Renderer {
  readonly object3D = new THREE.Group()
  private readonly torches: TorchRenderer[] = []
  private readonly chainLength: number
  private readonly assets: TorchSharedAssets

  constructor() {
    this.assets = createTorchSharedAssets()

    let lastSide = 0
    let sameSideRun = 0
    let z = 0

    for (let i = 0; i < TORCH_COUNT; i++) {
      let side: 1 | -1
      if (sameSideRun >= MAX_SAME_SIDE_RUN) {
        side = (-lastSide as 1 | -1)
      } else {
        side = Math.random() < 0.5 ? -1 : 1
      }
      if (side === lastSide) {
        sameSideRun++
      } else {
        lastSide = side
        sameSideRun = 1
      }

      const y = TORCH_Y + (Math.random() * 2 - 1) * HEIGHT_JITTER
      const x = TorchRenderer.computeMountX(side, y)
      const torch = new TorchRenderer(this.assets, side, x, y, z)
      torch.mount(this.object3D)
      this.torches.push(torch)

      z -= SPACING_CHOICES[Math.floor(Math.random() * SPACING_CHOICES.length)]
    }

    this.chainLength = -z
  }

  mount(parent: THREE.Object3D): void {
    parent.add(this.object3D)
  }

  update(dt: number): void {
    const ds = FORWARD_SPEED * dt
    for (const torch of this.torches) {
      let z = torch.getPositionZ() + ds
      if (z > RECYCLE_Z) z -= this.chainLength
      torch.setPositionZ(z)
      torch.update(dt)
    }
  }

  dispose(): void {
    for (const torch of this.torches) torch.dispose()
    this.torches.length = 0
    disposeTorchSharedAssets(this.assets)
    this.object3D.removeFromParent()
  }
}
