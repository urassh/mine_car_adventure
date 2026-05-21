import { FORWARD_SPEED } from '../constants'
import { BRANCH_OFFSET, BRANCH_TRAVERSE } from '../objects/Branch'

const TILT_ANGLE = 0.25
const TILT_LERP = 8

const BRANCH_SPAWN_Z = -36
const BRANCH_DESPAWN_Z = BRANCH_TRAVERSE + 6

const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export interface BranchState {
  readonly side: 1 | -1
  z: number
}

// プレイヤーが行える抽象操作と、それで遷移する状態。THREE 非依存。
export class GameController {
  lateral = 0
  roll = 0
  branch: BranchState | null = null
  baseLateral = 0

  private tilt: -1 | 0 | 1 = 0
  private tiltCurrent = 0

  setTilt(side: -1 | 0 | 1) {
    this.tilt = side
  }

  requestSpawnBranch() {
    if (this.branch) return
    if (this.tilt === 0) return
    this.branch = { side: this.tilt, z: BRANCH_SPAWN_Z }
  }

  update(dt: number) {
    this.updateBranch(dt)
    this.updateTilt(dt)
  }

  private updateBranch(dt: number) {
    const branch = this.branch
    if (!branch) {
      this.lateral = this.baseLateral
      return
    }

    branch.z += FORWARD_SPEED * dt

    if (branch.z >= 0) {
      const t = Math.min(branch.z / BRANCH_TRAVERSE, 1)
      this.lateral = this.baseLateral + branch.side * BRANCH_OFFSET * smoothstep(t)
    } else {
      this.lateral = this.baseLateral
    }

    if (branch.z > BRANCH_DESPAWN_Z) {
      this.baseLateral += branch.side * BRANCH_OFFSET
      this.lateral = this.baseLateral
      this.branch = null
      this.tilt = 0
    }
  }

  // +1 (右に傾く) で視界は左にロールするので符号は負。
  private updateTilt(dt: number) {
    const targetRoll = -this.tilt * TILT_ANGLE
    this.tiltCurrent += (targetRoll - this.tiltCurrent) * (1 - Math.exp(-TILT_LERP * dt))
    this.roll = this.tiltCurrent
  }
}
