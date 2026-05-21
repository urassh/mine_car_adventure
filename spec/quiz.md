# Quiz 機能 実装計画書

## 目的

廃坑トロッコの前進中に二択クイズを出題し、プレイヤーが**左右どちらのレールを選ぶか**で回答する遊びを追加する。既存の「傾き → Space で分岐生成 → 片腕に乗り換え」の入力体系をそのままクイズの解答 UI に転用する。

## 体験フロー

1. しばらく前進 → 奥から**質問看板 (QuestionSign)** が流れてくる
2. 看板に書かれた質問を読みながらさらに前進
3. 看板を通過したあと、奥に**Y 字分岐**が現れ、左右レールの脇に**選択肢看板 (ChoiceSign × 2)** が立っている
4. プレイヤーは矢印キー (←/→) で傾き、Space で分岐に乗り込む (既存操作)
5. 通り抜けた直後、**結果看板 (ResultSign)** が出て正誤と解説を表示
6. ResultSign が流れ去ったらサイクル先頭に戻り、次の問題へ

## 既存資産

- `public/quiz_data.json` … `{ id, question, choices: [{ label, direction, isCorrect }×2], explanation }` の配列
- `public/question_texture.png` … 木製プレート + チェーン枠の看板テクスチャ (QuestionSign / ChoiceSign / ResultSign で共用)
- `src/controllers/GameController.ts` … `tilt`, `branch`, `lateral`, `baseLateral` を管理。Quiz 側はこれを観察・トリガーするだけで済む
- `src/objects/Branch.ts` … Y 字分岐ピース。**Quiz では「左右両方の腕を見せて選ばせる」用途で流用**

## ファイル構成

```
src/
  quiz/
    QuizData.ts          # 型 + fetch ローダ
    QuizController.ts    # 出題サイクルの状態機械 (THREE 非依存)
  objects/
    QuestionSign.ts      # 木製プレート 3D。質問文は Canvas テクスチャで焼く
    ChoiceSign.ts        # 分岐レール脇に立つ標識
    ResultSign.ts        # 正誤 + 解説
  main.ts                # QuizController を組み込み、看板の生成・破棄を仲介
spec/
  quiz.md                # 本書
```

`GameController.ts` には**手を入れない**方針で進める。Quiz 側は GameController の状態を観察 + 必要なら `setTilt` / `requestSpawnBranch` を呼ぶだけ。これは設計上の境界線として明示しておく:

> GameController = 「トロッコがレール上でどう動くか」
> QuizController = 「どんな問題をいつ出すか、それが正解か」

## 状態機械 (QuizController)

```
Idle                     初期状態 or 直前の問題が片付いた状態
  ↓ 一定距離走行
QuestionApproaching      QuestionSign を奥に生成。手前まで流れて消える
  ↓ 看板がカメラを通過
BranchPending            次フレームで Branch を呼ぶ準備 (ChoiceSign を 2 枚生成)
  ↓ GameController.branch !== null になる
Answering                プレイヤー選択中。lateral が動いている
  ↓ GameController.branch === null (= 分岐通過完了)
Resolved                 baseLateral の符号変化と問題.choices[].direction を照合
  ↓ ResultSign がカメラ通過
Idle
```

各状態の遷移条件はすべて「距離 (= 経過時間 × FORWARD_SPEED) と既存 GameController の値の観察」で判定できる。ポーリング型でよく、イベント発火は不要。

## 入力の扱い

既存:
- ← / → : `setTilt(-1) / setTilt(1)`
- Space : `requestSpawnBranch()`

Quiz サイクル中の振る舞いの選択肢:

| 案 | 内容 | 評価 |
|----|------|------|
| A | Space は不要にし、`BranchPending` 進入時に QuizController 側から自動 spawn | 操作が 1 段減って初心者に優しい。傾き = 答え |
| B | Space は残し、答えを確定する「決定ボタン」として位置付ける | 操作は増えるが「考えて確定」の意思表示になる |

**推奨は A**。「進行は止められない、傾けた方に行く」が廃坑トロッコの世界観と噛み合う。Space は残すなら「タイマー前倒し (即答)」など別意味に。

採用方針: A を採る。`KeyboardInput` は触らず、`Answering` 直前で `GameController.requestSpawnBranch()` を QuizController が呼ぶ。tilt が 0 なら少し待つ (= プレイヤーが決め切らない場合はそのまま直進し、ChoiceSign を通過した時点で誤答扱い)。

## 看板の作り方

### 共通: テクスチャ + Canvas 焼き込み

- ベース: `public/question_texture.png` を `THREE.PlaneGeometry` に貼る
- 文字: `OffscreenCanvas`/`HTMLCanvasElement` に質問文 or ラベルを描き、それを別 Plane (or 透過オーバーレイ) として木枠の上に重ねる
- 木枠とは別に Plane を重ねた方が、テクスチャを汚さずに済む

簡易実装:
```ts
// QuestionSign.ts (概略)
class QuestionSign extends THREE.Group {
  constructor(text: string) {
    super()
    this.add(new Mesh(plateGeometry, plateMaterial))      // 木枠
    this.add(new Mesh(textGeometry, makeTextMaterial(text))) // 焼いた文字
  }
}
```

### サイズ・配置 (初期値、後でチューニング)

| 看板 | 寸法 (幅×高) | 配置 |
|------|-------------|------|
| QuestionSign | 3.0 × 1.0 m | y = 2.6 (アーチ頂点 2.5 のすぐ上)、x = 0、トンネル中央上方に吊り下げる雰囲気 |
| ChoiceSign | 1.2 × 0.4 m | 各分岐レールの脇 (x = ±BRANCH_OFFSET ± 1.0, y = 1.3) |
| ResultSign | 3.0 × 1.2 m | QuestionSign と同位置 |

すべて `lookAt(camera)` ではなく**カメラ向きに固定 (rotation.y = π or 0)**。揺れる必要はない。

## サイクルのタイミング設計

| 区間 | 距離 (m) | 説明 |
|------|---------|------|
| 待機 | 30 | 問題と問題の間。雰囲気を味わわせる |
| 質問提示 | 20 | QuestionSign が手前に流れ切るまで |
| 分岐進入 | 10 | ChoiceSign + Branch が手前に流れる |
| 結果表示 | 20 | ResultSign が手前に流れ切るまで |
| **合計** | 80 | 1 サイクル ≒ 10 秒 (FORWARD_SPEED=8 m/s) |

数値は `constants.ts` ではなく `quiz/QuizController.ts` 内にまとめる (Quiz 固有の調整領域なので)。

## 正誤判定

```ts
const goneRight = game.baseLateral > prevBaseLateral
const chose = goneRight ? 'right' : 'left'
const correct = currentQuestion.choices.find(c => c.direction === chose)?.isCorrect ?? false
```

`baseLateral` は分岐通過後にしか確定変化しないため、`Answering → Resolved` の瞬間に 1 度だけ評価する。

「答えなかった (tilt 0 のまま通過)」ケース: QuizController が `BranchPending` のタイムアウトで誤答扱いにする。ResultSign は「未回答」表示にする。

## スコア表示

最小実装: HTML オーバーレイで右上に `正解 N / 回答 M` を出すだけ。`index.html` に `<div id="score">` を置き、QuizController が `Resolved` 時に更新。

## 実装ステップ (各ステップは独立に動作確認できる粒度)

### Step 1. データ層
- `QuizData.ts`: 型定義 + `fetch('/quiz_data.json')`
- 起動時に読み込み、`console.table` で出ることを確認。
- これだけで他の機能は壊れない。

### Step 2. QuestionSign を 1 枚だけ静止表示
- main.ts で QuestionSign を生成し、トンネル奥 (z = -20) に固定配置
- まずテクスチャだけ。文字は出さない
- 「看板が見えるか・サイズ感は適切か」のみ確認

### Step 3. 文字焼き込み
- Canvas で質問文を描いて Texture 化
- 看板の上に重ねる
- 日本語フォントが意図通り出ているか確認

### Step 4. QuestionSign を流す
- `Arches` 等と同じく `FORWARD_SPEED * dt` で `position.z` を加算
- 手前を通り過ぎたら `scene.remove`
- まだ 1 枚だけ。サイクルなし

### Step 5. QuizController の状態機械を入れる
- `Idle → QuestionApproaching → ... → Idle` を距離駆動で回す
- 各遷移で `console.log` だけ出す
- 看板はまだ Step 4 と同じ 1 枚運用

### Step 6. ChoiceSign + 既存 Branch との結合
- `BranchPending` で `game.requestSpawnBranch()` を呼ぶ (tilt が 0 なら少し待つ)
- ChoiceSign を 2 枚生成し、`branchView` 同様 `position.z = game.branch.z` で追従
- 分岐に乗り込む UX が成立するか確認

### Step 7. ResultSign + 正誤判定
- `Resolved` で `baseLateral` 差分から選択を判定
- ResultSign 生成 + 流す
- ここで完全な 1 サイクルが回る

### Step 8. 連続出題 + スコア表示
- 問題インデックスを進めるロジック
- HTML オーバーレイに正答数表示

### Step 9 (任意・後回し)
- 全問終了時のリザルト画面
- 効果音 (正解音 / 不正解音)
- 残り問題数表示
- ランダム順 / 難易度別

## やらないこと (当面)

- 制限時間 (前進速度が事実上の制限時間として働く)
- 三択以上 (現状 quiz_data.json も 2 択固定)
- 問題編集 UI (JSON 直接編集で十分)
- セーブ / リプレイ機能

## リスク・検討事項

- **文字の可読性**: 暗いトンネル + フォグ (FogExp2 0.07) で看板の文字が読めない可能性。フォグの影響を受けない `MeshBasicMaterial` + 自前で発光感を出す or 看板付近に PointLight を仕込む。**Step 3 の段階で実機確認**。
- **分岐生成タイミング**: 看板を読む時間と分岐が手前に来るタイミングがずれると「読み終わってから選ぶ」体験にならない。Step 6 で要調整。
- **既存の手動分岐操作との競合**: Quiz 中に Space を押されると意図しないタイミングで spawn される。`requestSpawnBranch` に「Quiz 中はロック」のスイッチを足すか、Space 自体を無効化するか。**A 案採用時は Space を Quiz 中だけ無効化が素直**。
- **fetch のベースパス**: vite で `/quiz_data.json` がそのまま `public/` を指すかを Step 1 で確認。
