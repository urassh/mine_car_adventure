// World unit ≒ 1 メートル想定
//
// 座標系:
//   - カメラは原点付近に固定。シーン側を +Z 方向へ流して前進感を出す
//   - したがって「奥」= -Z、「手前 (カメラの後ろ)」= +Z
//
// ここにはプロジェクト横断の定数のみ置く。
// 個別オブジェクトの寸法・本数などは各オブジェクトのファイル内に定義する。

// --- 前進 ---
export const FORWARD_SPEED = 8 // m/s

// --- カメラ ---
export const CAMERA_HEIGHT = 1.4 // レール面からの目線の高さ
export const CAMERA_LOOK_AHEAD = 10 // 注視点の前方距離

// --- リサイクル境界 ---
// 各オブジェクトはこの Z を完全に通り過ぎたら奥へ戻す
export const RECYCLE_Z = 0
