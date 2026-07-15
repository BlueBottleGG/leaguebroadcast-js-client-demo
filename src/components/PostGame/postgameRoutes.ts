/**
 * Pure parser for LeagueBroadcast's native post-game route URIs.
 *
 * The backend broadcasts a route string (via `onPostGameEvents.onRouteUpdate`)
 * whenever the operator switches the active post-game analysis view. This maps
 * those URIs onto the scene's internal `screen` state so the shell can swap the
 * rendered component.
 *
 * Kept pure (no Vue, no client) so it can be unit-tested in isolation. Returns
 * `null` when the URI is unrecognised — callers keep the current screen.
 */

export type PostGameScreen =
  | 'overview'
  | 'player'
  | 'player-stats'
  | 'matchup'
  | 'series'
  | 'fearless'
  | 'combined'
  | 'fearless-tree'

export interface ParsedPostGameRoute {
  screen: PostGameScreen
  playerIndex?: number
  gameId?: number
  matchId?: number
}

/**
 * Parse a native post-game route URI into a screen descriptor.
 *
 * Recognised shapes (leading/trailing slashes and a `postgame`/`analysis`
 * prefix are tolerated):
 *   /analysis/game/:gameId                          → overview
 *   /analysis/player/items_and_runes/:gameId/:idx   → player
 *   /analysis/player/stats/:gameId/:idx             → player-stats
 *   /matchup/full/:matchId                          → matchup
 *   /matchup/current/:matchId                       → series
 *   /fearlessbans/:matchId                          → fearless
 *   /                                               → combined (caster-driven meta screen)
 *   /fearless-tree/:matchId                         → fearless-tree
 */
export function parsePostGameRoute(uri: string): ParsedPostGameRoute | null {
  if (!uri) return null

  // normalise: strip query/hash, collapse slashes, drop empty segments
  const clean = uri.split(/[?#]/)[0] ?? ''
  const segments = clean.split('/').filter((s) => s.length > 0)
  if (segments.length === 0) return { screen: 'combined' }

  // tolerate an optional leading "postgame" prefix so both
  // "postgame/analysis/game/1" and "analysis/game/1" resolve.
  if (segments[0]?.toLowerCase() === 'postgame') segments.shift()

  const head = segments[0]?.toLowerCase()

  const num = (raw?: string): number | undefined => {
    if (raw === undefined) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }

  if (head === 'analysis') {
    const kind = segments[1]?.toLowerCase()
    if (kind === 'game') {
      return { screen: 'overview', gameId: num(segments[2]) }
    }
    if (kind === 'player') {
      const sub = segments[2]?.toLowerCase()
      if (sub === 'items_and_runes') {
        return { screen: 'player', gameId: num(segments[3]), playerIndex: num(segments[4]) }
      }
      if (sub === 'stats') {
        return {
          screen: 'player-stats',
          gameId: num(segments[3]),
          playerIndex: num(segments[4]),
        }
      }
    }
    return null
  }

  if (head === 'matchup') {
    const kind = segments[1]?.toLowerCase()
    if (kind === 'full') return { screen: 'matchup', matchId: num(segments[2]) }
    if (kind === 'current') return { screen: 'series', matchId: num(segments[2]) }
    return null
  }

  if (head === 'fearlessbans') {
    return { screen: 'fearless', matchId: num(segments[1]) }
  }

  if (head === 'fearless-tree') {
    return { screen: 'fearless-tree', matchId: num(segments[1]) }
  }

  return null
}
