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

// --- カメラの揺れ (速度感) ---
// 振幅は cm オーダー。大きくすると酔うので控えめに。
// X (左右) は枕木の継ぎ目で横に振られる感じを意識して Y より気持ち大きめ。
export const CAMERA_SHAKE_AMP_X = 0.028 // m
export const CAMERA_SHAKE_AMP_Y = 0.018 // m
// 周波数は Hz。互いに非整数比にして「同じ波形に戻る」周期を長くする。
export const CAMERA_SHAKE_FREQ_X = 1.7
export const CAMERA_SHAKE_FREQ_Y = 2.3

// --- リサイクル境界 ---
// 各オブジェクトはこの Z を完全に通り過ぎたら奥へ戻す
export const RECYCLE_Z = 0
