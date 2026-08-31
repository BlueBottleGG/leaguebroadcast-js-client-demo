export interface ExperienceFields {
  previousLevel?: number | null
  current?: number | null
  nextLevel?: number | null
}

function num(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Fill percentage (0-100) for a level-progress bar.
 *
 * The game reports the XP thresholds around the current level, so "maxed out" shows up as an empty
 * span (`nextLevel <= previousLevel`) — there is deliberately no comparison against a level number,
 * because the cap moves with the patch and some champions climb past the usual one. A maxed player
 * reads as a full bar; a player the game has not sent XP for yet reads as empty.
 */
export function xpProgressPct(exp?: ExperienceFields | null): number {
  const previous = num(exp?.previousLevel)
  const next = num(exp?.nextLevel)
  const current = num(exp?.current)

  const span = next - previous
  if (span > 0) return Math.min(100, Math.max(0, ((current - previous) / span) * 100))

  // No span left to fill: maxed out once the game has actually reported XP, otherwise there is no
  // data yet (all-zero payload before the first ingame tick) and an empty bar is correct.
  return current > 0 || previous > 0 ? 100 : 0
}
