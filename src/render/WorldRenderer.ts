import * as THREE from 'three'
import { BRANCH_DESPAWN_Z, BRANCH_SPAWN_Z, FORWARD_SPEED } from '../core/constants'
import { CameraRig } from './camera/CameraRig'
import { PlayerRenderer } from './player/PlayerRenderer'
import { ArchFieldRenderer } from './world/ArchFieldRenderer'
import { BranchRenderer } from './world/BranchRenderer'
import { CartRenderer } from './world/CartRenderer'
import { DustRenderer } from './world/DustRenderer'
import { RailFieldRenderer } from './world/RailFieldRenderer'
import { TieFieldRenderer } from './world/TieFieldRenderer'
import { TorchFieldRenderer } from './world/TorchFieldRenderer'
import { TunnelRenderer } from './world/TunnelRenderer'

const DARK = 0x050505

export type BranchSide = 1 | -1

export class WorldRenderer {
  readonly player: PlayerRenderer

  private readonly scene = new THREE.Scene()
  private readonly webgl: THREE.WebGLRenderer
  private readonly cameraRig = new CameraRig()
  private readonly ambient: THREE.AmbientLight

  private readonly rails = new RailFieldRenderer()
  private readonly ties = new TieFieldRenderer()
  private readonly tunnel = new TunnelRenderer()
  private readonly arches = new ArchFieldRenderer()
  private readonly torches = new TorchFieldRenderer()
  private readonly dust = new DustRenderer()
  private readonly cart = new CartRenderer()
  private readonly branch = new BranchRenderer()

  private branchActive = false
  private branchAnchorX = 0
  private branchZ = 0

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(DARK)
    this.scene.fog = new THREE.FogExp2(DARK, 0.07)

    this.webgl = new THREE.WebGLRenderer({ antialias: true })
    this.webgl.setPixelRatio(window.devicePixelRatio)
    this.webgl.setSize(window.innerWidth, window.innerHeight)
    this.webgl.localClippingEnabled = true
    container.appendChild(this.webgl.domElement)

    this.ambient = new THREE.AmbientLight(0xffcfa3, 0.15)
    this.scene.add(this.ambient)

    this.rails.mount(this.scene)
    this.ties.mount(this.scene)
    this.tunnel.mount(this.scene)
    this.arches.mount(this.scene)
    this.torches.mount(this.scene)
    this.dust.mount(this.scene)
    this.branch.mount(this.scene)

    this.player = new PlayerRenderer(this.cameraRig, this.cart, [
      this.rails,
      this.ties,
      this.tunnel,
      this.arches,
      this.torches,
      this.dust,
    ])
    this.scene.add(this.cameraRig.camera)
  }

  pushBranch(_side: BranchSide, baseX: number): void {
    if (this.branchActive) return
    this.branchActive = true
    this.branchAnchorX = baseX
    this.branchZ = BRANCH_SPAWN_Z
  }

  update(dt: number): void {
    this.rails.update(dt)
    this.ties.update(dt)
    this.tunnel.update(dt)
    this.arches.update(dt)
    this.torches.update(dt)
    this.dust.update(dt)

    if (this.branchActive) {
      this.branchZ += FORWARD_SPEED * dt
      if (this.branchZ > BRANCH_DESPAWN_Z) {
        this.branchActive = false
      }
    }

    if (this.branchActive) {
      this.branch.show(this.branchAnchorX, this.branchZ)
      this.tunnel.setBranchClip(this.branchZ)
    } else {
      this.branch.hide()
      this.tunnel.clearBranchClip()
    }
  }

  render(): void {
    this.webgl.render(this.scene, this.cameraRig.camera)
  }

  resize(): void {
    this.cameraRig.resize()
    this.webgl.setSize(window.innerWidth, window.innerHeight)
  }

  dispose(): void {
    this.rails.dispose()
    this.ties.dispose()
    this.tunnel.dispose()
    this.arches.dispose()
    this.torches.dispose()
    this.dust.dispose()
    this.player.dispose()
    this.branch.dispose()
    this.webgl.dispose()
    this.webgl.domElement.remove()
  }
}
