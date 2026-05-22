# リアーキテクチャ設計案: Render 層の分離

## 1. 動機

現状は `objects/` 配下のクラスが「`THREE.Group` を継承したシーン部品」として作られており、`main.ts` が次のような責務を直接持っている:

- `THREE.Scene` / `THREE.WebGLRenderer` の生成・設定
- `Rails`・`Ties`・`Tunnel`・`Arches`・`Torches`・`Dust`・`MineCart` のインスタンス化と `scene.add`
- フレームごとに各オブジェクトの `update(dt)` を呼ぶ
- `game.lateral` を読み取り、対象オブジェクトの `position.x` に書き戻す
- `game.branch` の有無を見て `Branch` を生成 / 破棄、`tunnel.setClip` を呼ぶ
- DOM オーバーレイ (`questionOverlay` 等) を毎フレーム触る

つまり「描画の詳細」が main とゲームロジック間に滲み出している。QuizController のようなロジック側からは

```ts
// やりたいのはこういう呼び方
world.setLateral(x)
world.showBranch({ side, z })
world.hideBranch()
```

で済むはずなのに、いまは Three.js の中身 (`clippingPlanes`, `scene.add`, `position.z`...) が呼び出し側に露出している。

ゴールは:

1. **Render 層を facade で隠す** — Three.js / DOM のセットアップを `main.ts` から追い出す
2. **シーン部品を Renderer として再定義** — 「`THREE.Group` の継承」ではなく「Three.js リソースを所有して update() を提供するオブジェクト」に
3. **ゲームロジックは描画詳細を知らない** — `GameController` / `QuizController` は今でも THREE 非依存だが、`main.ts` で漏れている整合性を facade に閉じ込める

---

## 2. レイヤリング (目標)

```
┌──────────────────────────────────────────────────┐
│ app/        main.ts (composition root + loop)    │
└──────────────┬─────────────────────┬─────────────┘
               │ uses                │ uses
       ┌───────▼────────┐    ┌───────▼────────┐
       │ game/          │    │ render/        │   ui/
       │ - QuizCtrl     │    │ - WorldRenderer│   - QuizView
       │ - GameCtrl     │    │ - *Renderer    │   (DOM)
       │ - KeyboardIn   │    │ - CameraRig    │
       │ (THREE 非依存) │    │ (THREE 専属)   │
       └───────┬────────┘    └───────┬────────┘
               │                     │
               └──────────┬──────────┘
                          ▼
                     core/ (constants, math)
```

依存方向のルール:

- `render/` は `game/` を **import しない** (ゲームの状態を「型」として受け取るだけ)
- `game/` は `render/` を import しない
- `app/` だけが両方を知り、状態 → 描画呼び出しの橋渡しをする
- 共有値 (`FORWARD_SPEED`, `RECYCLE_Z` 等) は `core/constants.ts` に置く

---

## 3. Render 層の構造

### 3.1 Renderer の契約

```ts
// render/Renderer.ts
export interface Renderer {
  /** 親 (Scene or Camera など) に取り付ける */
  mount(parent: THREE.Object3D): void

  /** 毎フレーム呼ばれる。描画の進行 (リサイクル, フリッカ等) を行う */
  update(dt: number, timeMs: number): void

  /** 取り外し + リソース解放 */
  dispose(): void
}
```

ポイント:

- **`extends THREE.Group` ではなく composition**。Renderer は内部に `THREE.Group` (または `THREE.Points` 等) を持ち、必要なときだけ `object3D` として公開する。`mount(parent)` で `parent.add(this.object3D)` を行う。
- これにより「Renderer を渡された側が `scene.add()` する」というツリー操作の責任が呼び出し側に残らない。

### 3.2 単体 Renderer / 群 Renderer の分離

現状の `objects/*.ts` は「複数本のレール」「複数の松明」「無数の塵」を 1 クラスにまとめて持っており、

- 単体パーツの形状・寸法・パーフレーム挙動 (例: 松明 1 本のフリッカ)
- 群としての配置・本数・リサイクル (例: 16 本の松明を Z 方向に何 m 間隔で並べ、後ろに抜けたら奥に戻す)

の 2 種類のロジックが同居している。これを **単体 Renderer + 群 Renderer** に分ける。

```
TorchRenderer         (1 本の松明: 柄・布巻き・炎・光源・フリッカ状態)
  ↑ 委譲
TorchFieldRenderer    (N 本: 左右壁の振り分け, 間隔抽選, Z リサイクル)
```

- **単体クラス** は「自分自身の見た目」だけに責任を持ち、対外的には `object3D` (`THREE.Group` など) と必要なら `update(dt, t)` を公開する
- **群クラス** は単体クラスを N 個生成・保持し、群でのみ意味があるロジック (チェーンリサイクル, ジッタ, 左右壁制約 等) を担う。単体側の内部 (ジオメトリ詳細) には触らない

旧 (`objects/`) → 新 (`render/world/`) の対応:

| 旧クラス | 新: 単体 Renderer | 新: 群 Renderer | 群側の責務 |
|---|---|---|---|
| `Rails` | `RailRenderer` (1 レール 1 セグメント) | `RailFieldRenderer` | 左右 2 本 × N セグメントのチェーン配置 + リサイクル |
| `Ties` | `TieRenderer` (1 枕木) | `TieFieldRenderer` | 等間隔配置 + リサイクル |
| `Tunnel` | `TunnelSegmentRenderer` (円筒 1 個) | `TunnelRenderer` | N セグメントチェーン + クリップ面 (`setBranchClip` / `clearBranchClip`) |
| `Arches` | `ArchRenderer` (1 アーチ = 柱 2 + 梁 2) | `ArchFieldRenderer` | 寸法ジッタ + 等間隔配置 + リサイクル |
| `Torches` | `TorchRenderer` (1 松明) | `TorchFieldRenderer` | 左右壁振り分け / 間隔抽選 / リサイクル |
| `Dust` | (なし: 単体粒子は持たない, 後述) | `DustRenderer` | `THREE.Points` のままで分割しない |
| `Branch` | `BranchRenderer` | (なし: 常時 0/1 個) | 出し入れだけ (3.4) |
| `MineCart` | `CartRenderer` | (なし: 単体) | カメラ下に固定 |
| `CameraRig` | `render/camera/CameraRig` | — | (ほぼそのまま) |

注:

- **Dust は単体クラスを切らない**。粒子は `THREE.Points` 上の頂点インデックスで管理しており「単体オブジェクト」として 1 つの mesh を持たない (= 単体に切り出すと無駄に重くなる)。「Field 相当が 1 クラスで完結」しているのを許容する。
- **Branch は常時 0 または 1 個**なので群クラスは作らない。`WorldRenderer` が show/hide を直接呼ぶ。
- **群側は単体側を import するが、単体側は群側を知らない**。寸法定数は群経由で渡すか、両者が `dimensions.ts` を参照する (3.3)。

### 3.2.1 単体 / 群の責務境界 — 具体例 (TorchRenderer / TorchFieldRenderer)

責務分担のイメージ:

```ts
// render/world/TorchRenderer.ts  ----  単体: 1 本の松明
export class TorchRenderer implements Renderer {
  readonly object3D: THREE.Group
  // 内部状態 (フリッカ)
  private noise = 0
  private target = sampleTarget()
  private resampleTimer = sampleInterval()
  private readonly flame: THREE.Mesh
  private readonly light: THREE.PointLight

  constructor(opts: { side: 1 | -1; y: number /* etc. */ })

  mount(parent: THREE.Object3D): void
  /** ちらつき更新だけ。Z 位置の進行は群側が触る */
  update(dt: number, timeMs: number): void
  dispose(): void

  /** 群側がリサイクルで使う最小限の操作 */
  setPositionZ(z: number): void
  getPositionZ(): number
}
```

```ts
// render/world/TorchFieldRenderer.ts  ----  群: 16 本の松明
export class TorchFieldRenderer implements Renderer {
  private readonly torches: TorchRenderer[] = []
  private readonly chainLength: number

  constructor() {
    // 左右の振り分け (MAX_SAME_SIDE_RUN), 間隔抽選 (SPACING_CHOICES),
    // 高さジッタ (HEIGHT_JITTER), 個数 (TORCH_COUNT) — すべてここに集約
    // 配置が決まったら TorchRenderer をその数だけ作って自分の group に mount
  }

  mount(parent: THREE.Object3D): void
  update(dt: number, t: number): void {
    // 群でのみ意味がある責務:
    //   1. 全松明を ds 進める
    //   2. RECYCLE_Z を超えたら chainLength 分奥に戻す
    //   3. 各松明の update(dt, t) を呼ぶ (= フリッカは委譲)
  }
  dispose(): void
}
```

ポイント:

- **状態の所在**: フリッカの状態 (`noise`, `target`, `resampleTimer`) は **単体側**。群側に巨大な struct of arrays を持たせない (旧実装はそうなっていた)
- **群でのみ知っている情報**: 隣の松明の壁 (連続上限), 全体のチェーン長, 個数 — これらは単体側に漏らさない
- **位置の更新**: 群が `setPositionZ` で書き換える。単体側は受け取った値で `object3D.position.z` を更新する。これにより「Z は誰が変える」が一意になる

同じ要領で `RailRenderer / RailFieldRenderer`, `TieRenderer / TieFieldRenderer`, `ArchRenderer / ArchFieldRenderer`, `TunnelSegmentRenderer / TunnelRenderer` を作る。

### 3.3 寸法定数の共有モジュール

現状 `objects/` 内のファイルが互いに `import` し合っている (例: `Branch.ts` が `Tunnel.ts` の `TUNNEL_CENTER_Y` を、`Torches.ts` が `Arches.ts` の `ARCH_SPACING` を参照)。これを Renderer 同士の直接参照ではなく、

```
render/world/dimensions.ts
  - TIE_HEIGHT, TIE_SPACING
  - TUNNEL_RADIUS, TUNNEL_CENTER_Y
  - ARCH_SPACING, WOOD_THICKNESS, postCenterXAt()
  - RAIL_GAUGE, RAIL_HEIGHT
  - BRANCH_OFFSET, BRANCH_LENGTH
```

の単一ソースに統合する。Renderer は dimensions だけを参照し、Renderer 同士は隣の存在を知らない。

### 3.4 BranchRenderer の扱い

現状 `main.ts` は

```ts
if (game.branch) {
  if (!branchView) { branchView = new Branch(); branchView.position.x = ...; scene.add(branchView) }
  branchView.position.z = game.branch.z
  tunnel.setClip(game.branch.z)
} else if (branchView) {
  scene.remove(branchView); branchView = null; tunnel.clearClip()
}
```

を毎フレーム回している。Branch メッシュの生成コスト (peanut tunnel の 64×32 頂点ジオメトリ) を考えると、毎回 `new` するのは無駄。

`BranchRenderer` は **生成済みで scene に常駐させ、visible で出し入れ**する設計にする:

```ts
class BranchRenderer implements Renderer {
  show(side: 1 | -1, z: number, baseLateral: number): void   // 表示 + 位置設定
  hide(): void
  update(dt, t): void  // 必要なら
}
```

`TunnelRenderer.setBranchClip` の呼び出しも `WorldRenderer` 内に閉じる (3.5)。

### 3.5 WorldRenderer (facade)

`render/WorldRenderer.ts` が外向きの窓口。`main.ts` からはこれだけ触れば済む:

```ts
/** WorldRenderer が描画に必要とする読み取り専用 view。
 *  GameController のフィールド名と一致させることで構造的部分型として直接渡せる。
 *  この型を render/ に置くことで「render が game を import しない」が保てる。 */
export interface WorldFrameView {
  readonly lateral: number
  readonly roll: number
  readonly baseLateral: number
  readonly branch: { readonly side: 1 | -1; readonly z: number } | null
}

export class WorldRenderer {
  constructor(container: HTMLElement)

  /** 1 フレーム分を描画 (state は構造的に GameController を直接渡せる) */
  render(state: WorldFrameView, dt: number, timeMs: number): void

  resize(): void
  dispose(): void
}
```

内部で持つもの:

- `THREE.Scene`, `THREE.WebGLRenderer`, `THREE.Fog`, ambient light
- `CameraRig`
- 各 `*Renderer` のインスタンス (rail/tie/tunnel/arch/torch field 群, dust, cart, branch)
- 「lateral シフトを適用する対象」の参照リスト (現状 `laterallyShifted` 配列に相当, 内部に閉じる)

`render()` の中で:

1. 各 Renderer の `update(dt, t)` を呼ぶ
2. `state.lateral` を該当 Renderer 群に分配する
3. `state.branch` を `BranchRenderer.show/hide` と `TunnelRenderer.setBranchClip/clear` に伝える
4. `cameraRig.setLateral/setRoll/tick` を呼ぶ
5. `webglRenderer.render(scene, cameraRig.camera)`

`GameController` は既に `lateral / roll / baseLateral / branch` を公開しているので、main からは `world.render(game, dt, time)` で直接渡せる (構造的部分型)。**DTO の組み立てを main.ts でする必要はない**。

### 3.6 main.ts の役割 (固定)

`main.ts` は次の 2 つだけに責任を絞る。それ以外のロジックが入ってきたら **その時点でそれは別の層に出すべきサイン**。

1. **オブジェクトの組み立て (wiring)** — World / Game / Quiz / KeyboardInput / QuizView の生成と相互接続
2. **イベントループの提供** — `requestAnimationFrame` 系のループを回し、各レイヤの `update` / `render` / `sync` を順に呼ぶだけ

main.ts に書いてはいけないもの (= どこかの層に押し戻すもの):

- THREE.* の import や Scene / Renderer の構築 → `WorldRenderer` の中
- DOM 要素の取得・class 操作・textContent 書き換え → `QuizView` の中
- `game.branch` から `branch view` を生成 / 削除する分岐, `tunnel.setClip` の呼び出し → `WorldRenderer` の中
- `game.lateral` を各オブジェクトの `position.x` に分配する処理 → `WorldRenderer` の中
- Quiz の state を見て複数オーバーレイの hidden を切り替える分岐 → `QuizView.sync()` の中

最終形の `main.ts` イメージ (これより太らせない):

```ts
import './style.css'
import { GameController } from './game/GameController'
import { KeyboardInput } from './game/KeyboardInput'
import { QuizController } from './quiz/QuizController'
import { loadQuizData } from './quiz/QuizData'
import { WorldRenderer } from './render/WorldRenderer'
import { QuizView } from './ui/QuizView'

const app = document.querySelector<HTMLDivElement>('#app')!

// --- wiring ---
const world = new WorldRenderer(app)
const game = new GameController()
const quiz = new QuizController(game)
const quizView = new QuizView(document)
const keyboard = new KeyboardInput(game)

keyboard.attach()
window.addEventListener('resize', () => world.resize())
loadQuizData().then((qs) => quiz.setQuestions(qs)).catch(console.error)

// --- loop ---
let prev = 0
const tick = (time: number) => {
  const dt = prev === 0 ? 0 : (time - prev) / 1000
  prev = time
  quiz.update(dt)
  game.update(dt)
  world.render(game, dt, time)
  quizView.sync(quiz, game)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
```

(`setAnimationLoop` を使うかは好みで可。要点は「wiring + ループだけ」)

---

## 4. 設計上の判断とトレードオフ

### 4.1 状態の渡し方: 構造的 view 型を引数に取る

**採用: render 層が `WorldFrameView` という read-only interface を宣言し、`GameController` が結果的にそれを満たす。main からは `world.render(game, dt, t)` で直接渡す。**

- 利点: `WorldRenderer` が `GameController` の class を import しない (依存方向は片側通行のまま) のに、main で DTO を毎フレーム組み立てる必要がない (= main を細く保てる)
- 利点: 構造的部分型なので、`GameController` 側が型注釈を付けなくても自動的に view を満たす
- 注意: `GameController` のフィールドを安易に rename すると render が壊れる。これは適切な単体テスト or 型エラーで早期検出する

### 4.2 Renderer は `THREE.Group` を継承する? しない?

**採用: 継承しない (composition)**

- 継承だと「Renderer = シーングラフのノード」と「Renderer = ライフサイクルを持つ部品」が同一視され、`mount/dispose` の意味が薄れる
- ゲームロジック側は `world.setLateral(x)` のような操作で済むようにするのがゴール。`world.rails.position.x = ...` を許す形には戻したくない
- 欠点: ボイラープレートが少し増える (`this.group = new THREE.Group()` + `mount` で `parent.add(this.group)`)。許容範囲

### 4.3 アニメーションループはどこに置く?

選択肢:

- A. `App` (main.ts) が `setAnimationLoop` を保持し、コールバック内で `quiz.update / game.update / world.render` を順に呼ぶ
- B. `WorldRenderer` が `start(tick: (dt, t) => void)` を提供し、`tick` で App がゲーム更新を行う (Inversion)

**採用: A**。理由:

- A の方がデータフローが上から下に流れて読みやすい (App → game → world)
- B はテスト時にループ制御を奪うのが煩雑
- ただし「`setAnimationLoop` を呼ぶための `webglRenderer` 参照」を App に露出させないため、`world.tick(state, dt, time)` だけ呼ぶ形にする (= `render` メソッドそのもの)

### 4.4 UI (DOM オーバーレイ) はこの設計に含めるか?

**含める。同じ思想で `ui/QuizView.ts` を作り、main から DOM コードを完全に追い出す**:

```ts
class QuizView {
  constructor(root: Document | HTMLElement)
  /** 1 フレーム分の同期。差分検出 (renderedQuestionId など) は内部に閉じる */
  sync(quiz: QuizController, game: GameController): void
  dispose(): void
}
```

- `sync()` は構造的に `QuizController` と `GameController` の必要フィールドだけを取る view 型を要求する形にしておく (4.1 と同じパターン)
- 「Selecting / Answering / Resolved / Idle に応じてどのオーバーレイを hidden にするか」「`renderedQuestionId` での差分回避」「`game.branch.side` から chosen を求める」も全て `QuizView` 内に閉じる
- main.ts は `quizView.sync(quiz, game)` をループ内で 1 回呼ぶだけ

Render 層と並走して着手しても良いが、コミットは分ける (PR を切る単位として独立)。

---

## 5. ディレクトリ構成 (移行後)

```
src/
├── app/
│   └── main.ts                       # composition root, animation loop
├── core/
│   └── constants.ts                  # FORWARD_SPEED, RECYCLE_Z
├── game/
│   ├── GameController.ts             # (移動のみ, 中身ほぼ変えず)
│   ├── KeyboardInput.ts
│   └── types.ts                      # BranchState など
├── quiz/
│   ├── QuizController.ts
│   └── QuizData.ts
├── render/
│   ├── Renderer.ts                   # Renderer インターフェース
│   ├── WorldRenderer.ts              # facade
│   ├── camera/
│   │   └── CameraRig.ts
│   └── world/
│       ├── dimensions.ts             # 共有寸法定数
│       ├── RailRenderer.ts           # 単体
│       ├── RailFieldRenderer.ts      # 群
│       ├── TieRenderer.ts
│       ├── TieFieldRenderer.ts
│       ├── TunnelSegmentRenderer.ts
│       ├── TunnelRenderer.ts         # 群 + クリップ面
│       ├── ArchRenderer.ts
│       ├── ArchFieldRenderer.ts
│       ├── TorchRenderer.ts
│       ├── TorchFieldRenderer.ts
│       ├── DustRenderer.ts           # 単体/群を切らない (Points 1 つ)
│       ├── BranchRenderer.ts         # 単体, 常時 0/1
│       └── CartRenderer.ts
├── textures/
│   └── procedural.ts                 # (変えない)
├── ui/                               # 後続 PR
│   └── QuizView.ts
└── style.css
```

---

## 6. 移行ステップ (各ステップで `npm run dev` が通る粒度)

### Step 1. 受け皿だけ作る
- `src/render/Renderer.ts` (インターフェース) を追加
- `src/render/world/dimensions.ts` を追加し、現状の `objects/*.ts` から **export されている定数だけ** を移す (`TIE_HEIGHT`, `TUNNEL_RADIUS`, `TUNNEL_CENTER_Y`, `ARCH_SPACING`, `WOOD_THICKNESS`, `postCenterXAt`, `BRANCH_OFFSET`, `BRANCH_TRAVERSE`)
- `objects/*.ts` 側では `dimensions.ts` から re-export するか、import 元を切り替える
- この時点ではまだ動作変更なし

### Step 2. 一番単純なものから単体/群に分割
- まず `Rails` を `RailRenderer` (単体: 1 セグメント) + `RailFieldRenderer` (群: 左右 N セグメントのチェーン) に分割
- `extends THREE.Group` をやめて composition 化。`mount/update/dispose` を実装
- `main.ts` で `const rails = new RailFieldRenderer(); rails.mount(scene)` に置き換え
- 横シフトは当面 `rails.object3D.position.x = game.lateral` で良い (facade 化は Step 4)
- 動作確認できたら同じパターンで `Ties`, `Arches`, `Torches`, `MineCart` (単体のみ), `Dust` (分割しない) を順次

### Step 3. `TunnelRenderer` と `BranchRenderer`
- Tunnel: `TunnelSegmentRenderer` (1 円筒) + `TunnelRenderer` (チェーン + `setBranchClip(z)` / `clearBranchClip()`) に分割
- Branch: 常駐 + visible 切替の設計に変更。`show(side, z, baseLateral)` / `hide()` を実装

### Step 4. `WorldRenderer` 導入 + main.ts 細身化
- 各 *FieldRenderer / 単体 Renderer を内部に取り込み、`render(view, dt, t)` を実装 (view は構造的に GameController を満たす)
- `main.ts` から Three.js セットアップ (Scene, WebGLRenderer, Fog, AmbientLight) を `WorldRenderer` に移す
- `main.ts` から「branch view の生成 / 削除」「`tunnel.setClip` 呼び出し」「lateral の各オブジェクトへの分配」を全て `WorldRenderer` に移す
- `main.ts` を 3.6 の最終形まで縮める

### Step 5. UI 層を `QuizView` に分離
- DOM 取得・class 操作・差分検出・state ↔ overlay の対応付けを `ui/QuizView.ts` に集約
- `main.ts` から DOM コードを完全に追い出す

各ステップで `objects/` ファイルを削除するのは置き換えが終わってから。途中の状態では旧クラスが残っていても OK (cycle が無い限り)。

---

## 7. やらないこと (今回のリアーキテクチャ範囲外)

- レンダリングパス自体の変更 (postprocess 等)
- マテリアル / テクスチャの差し替え
- `QuizController` / `GameController` の内部ロジックの変更
- テストフレームワーク導入。ただし Renderer 化は将来のテスト容易性に効く副作用がある

---

## 8. 完了の定義

- [ ] `src/main.ts` 内に `THREE.*` の import が無い
- [ ] `src/main.ts` 内に DOM 要素の取得 / class 操作 / textContent 書き換えが無い
- [ ] `src/main.ts` の中身が「wiring + ループ」のみ (3.6 のサンプル程度の行数に収まる)
- [ ] `src/objects/` ディレクトリが削除されている
- [ ] `src/render/world/` の各群 Renderer (`*FieldRenderer`, `TunnelRenderer` 等) が単体 Renderer に委譲しており、配置 / リサイクル / 本数制約以外のロジックを抱えていない
- [ ] `src/render/WorldRenderer.ts` だけで描画詳細が完結している (Branch の出し入れ / Tunnel のクリップ / lateral シフトの分配がすべて内部)
- [ ] ゲームロジックから `world` への呼び出しが `render(view, dt, t)` + `resize()` + `dispose()` だけになっている
- [ ] 既存の見た目・挙動に視覚的なリグレッションが無い
