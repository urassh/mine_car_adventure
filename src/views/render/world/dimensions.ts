export const TIE_LENGTH = 1.6
export const TIE_WIDTH = 0.2
export const TIE_HEIGHT = 0.1
export const TIE_SPACING = 0.6
export const TIE_COUNT = 200

export const RAIL_GAUGE = 1.0
export const RAIL_WIDTH = 0.08
export const RAIL_HEIGHT = 0.08
export const RAIL_SEGMENT_LENGTH = 100
export const RAIL_SEGMENT_COUNT = 2

export const TUNNEL_RADIUS = 1.7
export const TUNNEL_CENTER_Y = 1.5
export const TUNNEL_SEGMENT_LENGTH = 100
export const TUNNEL_SEGMENT_COUNT = 2
export const TUNNEL_RADIAL_SEGMENTS = 32

export const POST_BOTTOM_Y = 0
export const WOOD_THICKNESS = 0.18
export const POST_BOTTOM_X = 0.78
export const POST_TOP_X = 0.5
export const POST_TOP_Y = 2.1
export const APEX_Y = 2.5
export const ARCH_SPACING = 4
export const ARCH_COUNT = 50

export function postCenterXAt(y: number): number {
  const t = (y - POST_BOTTOM_Y) / (POST_TOP_Y - POST_BOTTOM_Y)
  return POST_BOTTOM_X + (POST_TOP_X - POST_BOTTOM_X) * t
}

