/**
 * Lane ordering for player lists that should read like the scoreboard:
 * top → jungle → mid → bot → support.
 *
 * The backend tags damage-graph entries with a lowercase role string
 * ("top" | "jungler" | "mid" | "bottom" | "support" — see the roleMap in
 * FrontendDamageGraphController), but neighbouring payloads spell the same
 * lanes differently ("adc", "utility", …) or omit the field entirely. Resolving
 * through an alias table means an upstream spelling change degrades to "lane
 * unknown" — and a preserved payload order — instead of silently scrambling the
 * rows.
 */

/** Display labels per lane index, used for icon alt text. */
export const LANE_LABELS = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'] as const

/** Lookup keys are lowercased with spaces, dashes and underscores stripped. */
const LANE_INDEX_BY_ALIAS: Record<string, number> = {
  top: 0,
  toplane: 0,
  jungle: 1,
  jungler: 1,
  jgl: 1,
  jg: 1,
  mid: 2,
  middle: 2,
  midlane: 2,
  bottom: 3,
  bot: 3,
  botlane: 3,
  adc: 3,
  marksman: 3,
  support: 4,
  supp: 4,
  sup: 4,
  utility: 4,
}

/**
 * Lane index (0 = top … 4 = support) for a backend role tag, or `undefined`
 * when the payload carries no role or an unrecognised one.
 */
export function laneIndexFromRole(role: string | null | undefined): number | undefined {
  if (!role) return undefined
  return LANE_INDEX_BY_ALIAS[
    role
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, '')
  ]
}
