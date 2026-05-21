import * as THREE from 'three'

// 廃坑シーン向けのプロシージャル・テクスチャ。
//
// 設計の柱:
//   - 値ノイズ (value noise) を整数周期でラップさせ、完全に seamless にタイル可能なものを作る
//   - fbm (多重周波数の重ね合わせ) で岩・木・金属らしい有機的な凹凸を出す
//   - 1 度生成したベース canvas は使い回す。THREE.CanvasTexture は複数インスタンス
//     から同じ canvas を参照できるので、repeat / rotation などはインスタンスごとに設定する
//
// 後で実画像 (Poly Haven などの jpg/png) に差し替えたくなったときは、
// `createXxxTextures()` の中身を `new THREE.TextureLoader().load(...)` に
// 置き換えれば呼び出し側はそのまま動く。

const SIZE = 512

// --- 整数周期でラップする値ノイズ ---

const smooth = (t: number) => t * t * (3 - 2 * t)

function hash2(ix: number, iy: number, period: number): number {
  // 周期内に丸めてからハッシュ → period 単位で完全に同じ値が返る
  const x = ((ix % period) + period) % period
  const y = ((iy % period) + period) % period
  let h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2654435761) >>> 0
  return h / 4294967295
}

function valueNoise(x: number, y: number, period: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const a = hash2(x0, y0, period)
  const b = hash2(x0 + 1, y0, period)
  const c = hash2(x0, y0 + 1, period)
  const d = hash2(x0 + 1, y0 + 1, period)
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

// 多重周波数を重ねた値ノイズ。baseFreq の倍数の周期でラップする。
function fbm(u: number, v: number, baseFreq: number, octaves: number): number {
  let sum = 0
  let amp = 1
  let total = 0
  let f = baseFreq
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(u * f, v * f, f) * amp
    total += amp
    f *= 2
    amp *= 0.5
  }
  return sum / total
}

// --- ピクセルごとのサンプル関数から map + bumpMap の canvas を作る ---

type Sample = { rgb: [number, number, number]; height: number }

function paintCanvases(compute: (u: number, v: number) => Sample): {
  color: HTMLCanvasElement
  bump: HTMLCanvasElement
} {
  const color = document.createElement('canvas')
  const bump = document.createElement('canvas')
  color.width = color.height = SIZE
  bump.width = bump.height = SIZE
  const cctx = color.getContext('2d')!
  const bctx = bump.getContext('2d')!
  const cimg = cctx.createImageData(SIZE, SIZE)
  const bimg = bctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const v = y / SIZE
      const s = compute(u, v)
      const i = (y * SIZE + x) * 4
      cimg.data[i + 0] = Math.max(0, Math.min(255, s.rgb[0]))
      cimg.data[i + 1] = Math.max(0, Math.min(255, s.rgb[1]))
      cimg.data[i + 2] = Math.max(0, Math.min(255, s.rgb[2]))
      cimg.data[i + 3] = 255
      const h = Math.max(0, Math.min(255, s.height * 255))
      bimg.data[i + 0] = h
      bimg.data[i + 1] = h
      bimg.data[i + 2] = h
      bimg.data[i + 3] = 255
    }
  }
  cctx.putImageData(cimg, 0, 0)
  bctx.putImageData(bimg, 0, 0)
  return { color, bump }
}

function configure(
  tex: THREE.CanvasTexture,
  isColor: boolean,
  repeatU: number,
  repeatV: number,
): void {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 4
  tex.repeat.set(repeatU, repeatV)
}

function instantiate(
  src: { color: HTMLCanvasElement; bump: HTMLCanvasElement },
  repeatU: number,
  repeatV: number,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const map = new THREE.CanvasTexture(src.color)
  const bumpMap = new THREE.CanvasTexture(src.bump)
  configure(map, true, repeatU, repeatV)
  configure(bumpMap, false, repeatU, repeatV)
  return { map, bumpMap }
}

// ベース canvas は種類ごとに 1 度だけ生成し、複数の Texture インスタンスから共有する
let rockCanvases: ReturnType<typeof paintCanvases> | null = null
let woodCanvases: ReturnType<typeof paintCanvases> | null = null
let metalCanvases: ReturnType<typeof paintCanvases> | null = null

// === 岩 (トンネル壁) ===
// 大局の凹凸 + ヒビ風の谷ノイズ。色は元の 0x3a2e22 (暗い茶灰) を中心に変調。
export function createRockTextures(repeatU: number, repeatV: number) {
  if (!rockCanvases) {
    rockCanvases = paintCanvases((u, v) => {
      const n = fbm(u, v, 5, 6)
      // |noise - 0.5| の反転で「谷」を作る → ヒビっぽいライン
      const crack = 1 - Math.abs(fbm(u, v, 10, 4) - 0.5) * 2
      const t = 0.4 + n * 0.85 - crack * 0.18
      return {
        rgb: [58 * t, 46 * t, 34 * t],
        height: n * 0.8 + crack * 0.2,
      }
    })
  }
  return instantiate(rockCanvases, repeatU, repeatV)
}

// === 木材 (枕木 / アーチ柱 / トロッコ縁) ===
// 仕上がりは「地肌の中明度の茶色 + 曲がった細い暗線 (= 木目線)」。
// 「sin の振幅をそのまま明度に使う」と滑らかなグラデ縞 (= 塗装の縞) になるので、
// sin の零点近傍だけを浮かび上がらせて、線を細く尖らせる方式にする:
//
//   line = pow(1 - |sin(...)|, k)
//
// k を大きく (5〜8) するほど線が細く鋭くなる。
// さらに 2D ノイズで sin の位相を大きく歪ませて、木目線を有機的にうねらせる。
// 整数倍の周波数 (= 5) なのでタイル境で sin の位相は必ず元に戻る (seamless)。
export function createWoodTextures(repeatU: number, repeatV: number) {
  if (!woodCanvases) {
    woodCanvases = paintCanvases((u, v) => {
      // 地肌の色むら・節 (低周波)
      const tone = fbm(u, v, 2, 5)
      // 木目線を歪ませる 2D ノイズ。係数 0.7 で大きくうねらせる
      const distort = fbm(u, v, 3, 5)
      const grain = Math.sin((u * 5 + distort * 0.7) * Math.PI * 2)
      // sin の零点付近だけ立つ細い線
      const grainLine = Math.pow(1 - Math.abs(grain), 6)
      // 細かい繊維テクスチャ (うっすら)
      const fiber = fbm(u, v, 14, 3)
      // 明度: 地肌から木目線を差し引く
      const value = 0.5 + tone * 0.35 + (fiber - 0.5) * 0.1 - grainLine * 0.45
      const t = Math.max(0.08, value)
      return {
        rgb: [125 * t, 80 * t, 42 * t],
        // bump も同じ value を使う → 木目線が彫り込まれた溝のように凹む
        height: Math.max(0, Math.min(1, value)),
      }
    })
  }
  return instantiate(woodCanvases, repeatU, repeatV)
}

// === 金属 (レール) ===
// 細かい荒れ + 緩い色むらで「使い古された鉄」感を出す。
// レールは細いので異方性 (縦縞) は控えめ。fbm の合成で十分。
export function createMetalTextures(repeatU: number, repeatV: number) {
  if (!metalCanvases) {
    metalCanvases = paintCanvases((u, v) => {
      const fine = fbm(u, v, 24, 4)
      const broad = fbm(u, v, 4, 3)
      const value = fine * 0.5 + broad * 0.5
      const t = 0.6 + value * 0.55
      return {
        rgb: [138 * t, 122 * t, 90 * t],
        height: value,
      }
    })
  }
  return instantiate(metalCanvases, repeatU, repeatV)
}
