import type { killFeedEvent } from '@bluebottle_gg/league-broadcast-client'

/**
 * A kill feed row.
 *
 * Champion, monster and turret kills all arrive from the backend as `killFeedEvent`s.
 * Turret rows are tagged with `objective` so the entry draws the bundled turret icon
 * rather than looking for a champion square in the asset cache.
 */
export interface KillFeedItem extends killFeedEvent {
  objective?: 'turret'
}

/**
 * Does this backend kill feed event describe a turret?
 *
 * Matched on the asset path the backend controls (`.../killfeed/Tower_<team>.png`)
 * with the raw object name (`Turret_T1_L1_P1`) as a secondary signal.
 */
export function isTurretKill(event: killFeedEvent): boolean {
  const { alias, name, squareImg } = event.victim
  return (
    /\/Tower_\d+\.png$/i.test(squareImg ?? '') ||
    /^turret/i.test(alias ?? '') ||
    /^turret/i.test(name ?? '')
  )
}
