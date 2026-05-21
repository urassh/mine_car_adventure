import * as THREE from 'three'

// 一人称視点で常に画面手前に映るトロッコの縁。
// カメラの子オブジェクトとして取り付け、カメラ空間での相対座標で配置する。
// カメラ空間: -Z = 前方、+X = 右、+Y = 上 (カメラはデフォルト向きで lookAt 済み)。

// 内寸 (リム同士の内側距離)
// アーチ柱の内側 (足元で ±0.7m = 1.4m 幅) に余裕で収まるように外寸を抑える。
// 現状の外寸 = INNER_WIDTH + RIM_THICKNESS*2。
const INNER_WIDTH = 0.78 // X 方向 → 外寸 ~1.0m (アーチ柱内側に約 0.2m 余裕)
const INNER_LENGTH = 1.3 // Z 方向

// 縁 (リム) の角材
const RIM_THICKNESS = 0.11 // 厚み (リムの幅)
const RIM_HEIGHT = 0.16 // 高さ

// カメラ (= 視点) から見たリムの上面位置。値が小さい (= 下) ほど画面下にいく。
// 画面下端に「縁が手前にある」とはっきり分かる程度の高さに置く。
const RIM_TOP_Y = -0.42

// リムの下に伸びる内側板の高さ (これがあると視線を下げたときに「箱の中」感が出る)
const INNER_PANEL_HEIGHT = 0.35
const INNER_PANEL_THICKNESS = 0.04

// コーナーの縦柱 (リムを下から支える見た目の角材)
const CORNER_POST_HEIGHT = 0.5
const CORNER_POST_THICKNESS = 0.16

const RIM_CENTER_Y = RIM_TOP_Y - RIM_HEIGHT / 2

// カート自身に仕込む小さなランタン光。
// エミッシブだけだと全面が同じ明度になりのっぺり見えるため、
// 内側からの実光源で面ごとに陰影差を出す。
// 暗がりの雰囲気を壊さないよう「距離は短く・強度は控えめ」。
const INNER_LIGHT_COLOR = 0xffaa66
const INNER_LIGHT_INTENSITY = 0.7
const INNER_LIGHT_DISTANCE = 2.2
const INNER_LIGHT_DECAY = 2
// 内側板で囲まれた箱の中ほど。リム下面より少し下、底寄り。
const INNER_LIGHT_Y = RIM_TOP_Y - RIM_HEIGHT - 0.2

// 木箱の縁。コーナーには小さな縦柱を入れて「木組みの箱」らしさを足す。
export class MineCart extends THREE.Group {
  constructor() {
    super()

    const material = new THREE.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.95,
      // 真っ暗な区間で完全に消えないための最低限のセルフ発光のみ。
      // 主な陰影は下で追加する内部 PointLight に任せる。
      emissive: 0x1a0a02,
      emissiveIntensity: 0.8,
    })

    // --- 4 本のリム ---
    // 外形は内寸 + リム厚 * 2
    const outerWidth = INNER_WIDTH + RIM_THICKNESS * 2
    const outerLength = INNER_LENGTH + RIM_THICKNESS * 2

    // 前縁 (カメラ前方 = -Z 側)
    const longRimGeom = new THREE.BoxGeometry(outerWidth, RIM_HEIGHT, RIM_THICKNESS)
    const front = new THREE.Mesh(longRimGeom, material)
    front.position.set(0, RIM_CENTER_Y, -(INNER_LENGTH / 2 + RIM_THICKNESS / 2))
    this.add(front)

    // 後縁 (背後)
    const back = new THREE.Mesh(longRimGeom, material)
    back.position.set(0, RIM_CENTER_Y, +(INNER_LENGTH / 2 + RIM_THICKNESS / 2))
    this.add(back)

    // 左右の縁は、前後の縁と重ならないよう Z 方向は内寸長さに合わせる
    const sideRimGeom = new THREE.BoxGeometry(RIM_THICKNESS, RIM_HEIGHT, INNER_LENGTH)
    const left = new THREE.Mesh(sideRimGeom, material)
    left.position.set(-(INNER_WIDTH / 2 + RIM_THICKNESS / 2), RIM_CENTER_Y, 0)
    this.add(left)

    const right = new THREE.Mesh(sideRimGeom, material)
    right.position.set(+(INNER_WIDTH / 2 + RIM_THICKNESS / 2), RIM_CENTER_Y, 0)
    this.add(right)

    // --- 内側板 (リムの下に張った薄い側面板) ---
    // リムだけだと真下を見たときスカスカなので、内寸ぴったりに薄板で「壁」を作る
    const panelCenterY = RIM_TOP_Y - RIM_HEIGHT - INNER_PANEL_HEIGHT / 2

    const longPanelGeom = new THREE.BoxGeometry(INNER_WIDTH, INNER_PANEL_HEIGHT, INNER_PANEL_THICKNESS)
    const frontPanel = new THREE.Mesh(longPanelGeom, material)
    frontPanel.position.set(0, panelCenterY, -INNER_LENGTH / 2 + INNER_PANEL_THICKNESS / 2)
    this.add(frontPanel)
    const backPanel = new THREE.Mesh(longPanelGeom, material)
    backPanel.position.set(0, panelCenterY, +INNER_LENGTH / 2 - INNER_PANEL_THICKNESS / 2)
    this.add(backPanel)

    const sidePanelGeom = new THREE.BoxGeometry(INNER_PANEL_THICKNESS, INNER_PANEL_HEIGHT, INNER_LENGTH)
    const leftPanel = new THREE.Mesh(sidePanelGeom, material)
    leftPanel.position.set(-INNER_WIDTH / 2 + INNER_PANEL_THICKNESS / 2, panelCenterY, 0)
    this.add(leftPanel)
    const rightPanel = new THREE.Mesh(sidePanelGeom, material)
    rightPanel.position.set(+INNER_WIDTH / 2 - INNER_PANEL_THICKNESS / 2, panelCenterY, 0)
    this.add(rightPanel)

    // --- 四隅の縦柱 ---
    const postGeom = new THREE.BoxGeometry(
      CORNER_POST_THICKNESS,
      CORNER_POST_HEIGHT,
      CORNER_POST_THICKNESS,
    )
    // 柱の中心 Y はリム底面のすぐ下
    const postCenterY = RIM_TOP_Y - RIM_HEIGHT - CORNER_POST_HEIGHT / 2
    // 柱の中心 X/Z は外形に寄せる (リムの外側面と面一)
    const postX = outerWidth / 2 - CORNER_POST_THICKNESS / 2
    const postZ = outerLength / 2 - CORNER_POST_THICKNESS / 2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeom, material)
        post.position.set(sx * postX, postCenterY, sz * postZ)
        this.add(post)
      }
    }

    // --- カート内部の小光源 ---
    // 距離・強度ともに控えめにして、リム・内側板・四隅の柱に陰影差だけを与える。
    // カメラの子なので常にカートと一緒に動く = どこでもカートだけはちゃんと立体に見える。
    const innerLight = new THREE.PointLight(
      INNER_LIGHT_COLOR,
      INNER_LIGHT_INTENSITY,
      INNER_LIGHT_DISTANCE,
      INNER_LIGHT_DECAY,
    )
    innerLight.position.set(0, INNER_LIGHT_Y, 0)
    this.add(innerLight)
  }
}
