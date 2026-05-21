import * as THREE from 'three'
import { FORWARD_SPEED, RECYCLE_Z } from '../constants'

// 廃坑に漂う塵 / 霧の粒子。
//
// 方針:
//   - 個別のメッシュは作らず、1 個の THREE.Points (BufferGeometry) で全粒子を管理する
//   - 粒子はトンネル内の体積に一様分布。毎フレーム
//       y -= 落下速度 * dt    (重力)
//       z += FORWARD_SPEED * dt (世界が +Z へ流れる)
//     で動かす。カメラ後方 (z > RECYCLE_Z) または床下 (y < Y_MIN) に抜けたら
//     体積内のランダム位置にワープさせて再利用する。
//   - 加算ブレンドにして、松明の前を通過する粒子だけが浮かび上がるようにする。
//     暗がりではほぼ見えず、光を受けると輝く = 空中の塵らしい挙動。

const DUST_COUNT = 250

// 体積の範囲 (トンネル内寸に収まるように)
// トンネル: 中心 Y=1.5, 半径 1.7 → 床 ≒ -0.2, 天井 ≒ 3.2
const X_RANGE = 1.4 // ± 1.4 m
const Y_MIN = -0.1
const Y_MAX = 3.0
// 奥はフォグでほぼ見えなくなる距離まで。手前はカメラ位置 (= RECYCLE_Z)。
const Z_MIN = -28
const Z_MAX = RECYCLE_Z

// 落下速度 [m/s]。粒子ごとに変えて「ふわふわ」感を出す
const FALL_SPEED_MIN = 0.15
const FALL_SPEED_MAX = 0.45

// 見た目
// 加算ブレンドかつ黒背景なので、ベース色をかなり落として「光を受けたときだけ
// うっすら見える」程度に抑える。
const POINT_SIZE = 0.022 // ワールド単位 (sizeAttenuation: true)
const POINT_COLOR = 0x5a4a36 // 暗めの暖色。暗がりではほぼ沈み、松明前でだけ浮く

// 加算ブレンド前提の白っぽい円形 alpha テクスチャ。
// 単色の点ではエッジが立って粒子っぽさが出ないので、放射状にフェードさせる。
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

export class Dust extends THREE.Points {
  // 落下速度は不変なので生成時に決め打ち。位置だけ毎フレーム更新する。
  private readonly fallSpeeds: Float32Array
  private readonly positions: Float32Array
  private readonly positionAttr: THREE.BufferAttribute

  constructor() {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(DUST_COUNT * 3)
    const fallSpeeds = new Float32Array(DUST_COUNT)

    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * X_RANGE
      positions[i * 3 + 1] = Y_MIN + Math.random() * (Y_MAX - Y_MIN)
      positions[i * 3 + 2] = Z_MIN + Math.random() * (Z_MAX - Z_MIN)
      fallSpeeds[i] = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
    }

    const positionAttr = new THREE.BufferAttribute(positions, 3)
    positionAttr.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', positionAttr)

    const material = new THREE.PointsMaterial({
      color: POINT_COLOR,
      size: POINT_SIZE,
      sizeAttenuation: true,
      map: createDustTexture(),
      transparent: true,
      depthWrite: false, // 半透明 + 深度書き込みは粒子同士でアーティファクトの元
      blending: THREE.AdditiveBlending,
      fog: true,
    })

    super(geometry, material)
    this.fallSpeeds = fallSpeeds
    this.positions = positions
    this.positionAttr = positionAttr
    // 動的更新前提なのでフラスタムカリングは無効化 (体積全体が常に視野付近)
    this.frustumCulled = false
  }

  update(dt: number) {
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
        // カメラを越えた → 奥に巻き戻す。X/Y も振り直して同じ列が抜けるのを防ぐ
        positions[ix] = (Math.random() * 2 - 1) * X_RANGE
        positions[iy] = Y_MIN + Math.random() * ySpan
        positions[iz] -= zSpan
      } else if (positions[iy] < Y_MIN) {
        // 床下まで落ちた → 天井付近の別位置から再投入
        positions[ix] = (Math.random() * 2 - 1) * X_RANGE
        positions[iy] = Y_MAX
      }
    }

    this.positionAttr.needsUpdate = true
  }
}
