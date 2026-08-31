/**
 * One source of truth for champion-select choreography. Values are milliseconds
 * because Vue transitions, CSS custom properties, and browser timers all meet
 * at the scene boundary.
 */
export const CHAMPION_SELECT_TIMING = {
  brandRotationMs: 10_000,
  lockIn: {
    banFlashMs: 2_200,
    pickFeatureMs: 2_400,
    exitSettleMs: 380,
  },
  scene: {
    twoDimensional: { enterMs: 2_100, leaveMs: 1_000 },
    threeDimensional: { enterMs: 2_800, leaveMs: 1_250 },
  },
} as const

export function milliseconds(value: number): string {
  return `${value}ms`
}
