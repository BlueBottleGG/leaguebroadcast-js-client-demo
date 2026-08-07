import { ref, watch, onMounted, type Ref } from 'vue'
import type {
  LeagueBroadcastClient,
  postGamePlayerRunesAndItems,
  postGamePlayerStats,
  matchWithGamesAndTeams,
  matchOverviewData,
  simpleChampionData,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { usePostGameStatsVersion } from './usePostGame'

/**
 * Data layer for the post-game secondary screens (player analysis, stats,
 * matchup grid, series overview, fearless bans).
 *
 * Each composable returns a `Ref` that is fetched via `client.api.postGame`,
 * using the stored game id from `client.getPostGameData().gameId` when set and
 * the `getMock*` endpoints when the backend reports it is mocking. Errors are
 * swallowed to `null` with a `console.debug`, so a missing backend never
 * crashes a screen.
 *
 * Every composable also re-fetches when the backend broadcasts that a game
 * just ended and its stats were persisted ("postgame-stats-available"), so
 * pages that are already on screen update to the latest game automatically.
 */

/** Fetch on mount and again whenever new post-game stats become available. */
function fetchNowAndOnStatsUpdate(fetchData: () => void | Promise<void>): void {
  const statsVersion = usePostGameStatsVersion()
  onMounted(fetchData)
  watch(statsVersion, fetchData)
}

type FearlessBans = Record<number, Record<number, simpleChampionData[]>>

/** Resolve the game id to query: explicit route/component id, then stored id. */
function resolveGameId(gameIdRef?: Ref<number | undefined>): number | null {
  const explicitId = gameIdRef?.value
  if (typeof explicitId === 'number') return explicitId

  const client = useClient()
  try {
    const activeId = client.getPostGameData().activeComponent?.gameId
    if (typeof activeId === 'number') return activeId

    const id = client.getPostGameData().gameId
    return typeof id === 'number' ? id : null
  } catch {
    return null
  }
}

function isBackendMocking(client: LeagueBroadcastClient): boolean {
  // `isMocking` is seeded from REST on every (re)connect (client >= 1.4.1),
  // so the store value is reliable even on pages loaded mid-session.
  try {
    return client.getPostGameData().isMocking === true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Player runes & items
// ---------------------------------------------------------------------------
export function usePlayerAnalysis(
  playerIndexRef: Ref<number>,
  gameIdRef?: Ref<number | undefined>,
): Ref<postGamePlayerRunesAndItems | null> {
  const value = ref<postGamePlayerRunesAndItems | null>(null)

  const client = useClient()
  const fetchData = async () => {
    try {
      const idx = playerIndexRef.value
      const data = isBackendMocking(client)
        ? await client.api.postGame.getMockItemAndRunes()
        : await (async () => {
            const gameId = resolveGameId(gameIdRef)
            return gameId != null ? client.api.postGame.getItemsAndRunes(gameId, idx) : null
          })()
      value.value = data ?? null
    } catch (err) {
      console.debug('[usePlayerAnalysis] fetch failed', err)
      value.value = null
    }
  }
  fetchNowAndOnStatsUpdate(fetchData)
  watch(playerIndexRef, fetchData)
  if (gameIdRef) watch(gameIdRef, fetchData)
  return value
}

// ---------------------------------------------------------------------------
// Player stats
// ---------------------------------------------------------------------------
export function usePlayerStats(
  playerIndexRef: Ref<number>,
  gameIdRef?: Ref<number | undefined>,
): Ref<postGamePlayerStats | null> {
  const value = ref<postGamePlayerStats | null>(null)

  const client = useClient()
  const fetchData = async () => {
    try {
      const idx = playerIndexRef.value
      const data = isBackendMocking(client)
        ? await client.api.postGame.getMockPlayerStats()
        : await (async () => {
            const gameId = resolveGameId(gameIdRef)
            return gameId != null ? client.api.postGame.getPlayerStats(gameId, idx) : null
          })()
      value.value = data ?? null
    } catch (err) {
      console.debug('[usePlayerStats] fetch failed', err)
      value.value = null
    }
  }
  fetchNowAndOnStatsUpdate(fetchData)
  watch(playerIndexRef, fetchData)
  if (gameIdRef) watch(gameIdRef, fetchData)
  return value
}

// ---------------------------------------------------------------------------
// Match data (single current match)
// ---------------------------------------------------------------------------
export function useMatchData(): Ref<matchWithGamesAndTeams | null> {
  const value = ref<matchWithGamesAndTeams | null>(null)

  const client = useClient()
  fetchNowAndOnStatsUpdate(async () => {
    try {
      value.value = isBackendMocking(client)
        ? await client.api.postGame.getMockMatchData()
        : await (async () => {
            const gameId = resolveGameId()
            return gameId != null
              ? client.api.postGame.getMatchData(gameId)
              : client.api.postGame.getCurrentMatchData()
          })()
    } catch (err) {
      console.debug('[useMatchData] fetch failed', err)
      value.value = null
    }
  })
  return value
}

// ---------------------------------------------------------------------------
// Match list (for the matchup grid). Live falls back to the current match only.
// ---------------------------------------------------------------------------
export function useMatchList(): Ref<matchWithGamesAndTeams[]> {
  const value = ref<matchWithGamesAndTeams[]>([])

  const client = useClient()
  fetchNowAndOnStatsUpdate(async () => {
    try {
      const current = isBackendMocking(client)
        ? await client.api.postGame.getMockMatchData()
        : await client.api.postGame.getCurrentMatchData()
      value.value = current ? [current] : []
    } catch (err) {
      console.debug('[useMatchList] fetch failed', err)
      value.value = []
    }
  })
  return value
}

// ---------------------------------------------------------------------------
// Match overview (per-game summaries for the series screen)
// ---------------------------------------------------------------------------
export function useMatchOverview(): Ref<matchOverviewData | null> {
  const value = ref<matchOverviewData | null>(null)

  const client = useClient()
  fetchNowAndOnStatsUpdate(async () => {
    try {
      value.value = isBackendMocking(client)
        ? await client.api.postGame.getMockMatchOverview()
        : await client.api.postGame.getCurrentMatchOverview()
    } catch (err) {
      console.debug('[useMatchOverview] fetch failed', err)
      value.value = null
    }
  })
  return value
}

// ---------------------------------------------------------------------------
// Fearless bans (Record<gameNumber, Record<side, champs[]>>)
// ---------------------------------------------------------------------------
export function useFearlessBans(): Ref<FearlessBans | null> {
  const value = ref<FearlessBans | null>(null)

  const client = useClient()
  fetchNowAndOnStatsUpdate(async () => {
    try {
      // MatchApi exposes fearless bans; use the current-match endpoint.
      value.value = await client.api.match.getBans()
    } catch (err) {
      console.debug('[useFearlessBans] fetch failed', err)
      value.value = null
    }
  })
  return value
}
