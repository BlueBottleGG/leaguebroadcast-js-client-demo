import { ref, type Ref } from 'vue'
import {
  GameState,
  Team,
  type LeagueBroadcastClient,
  type teamMember,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'

/**
 * Shared, self-healing roster source for the player camera overlay.
 *
 * The old implementation fetched the roster once in `onMounted` per component.
 * In OBS the browser source usually loads long before a game is configured,
 * so `getCurrentGame()` returned nothing and the cameras stayed empty until
 * someone manually refreshed the source. This composable instead:
 *  - retries with backoff until a game exists,
 *  - refreshes when the ingame socket (re)connects or the game state changes,
 *  - polls slowly in the background to pick up roster/game swaps (Bo3, subs),
 *  - only publishes a new roster when it actually changed, so the camera
 *    iframes are never re-mounted (and re-negotiated) without reason.
 */

const RETRY_DELAYS_MS = [2_500, 5_000, 10_000, 20_000, 30_000]
const REFRESH_INTERVAL_MS = 60_000

type Rosters = Record<number, teamMember[]>

const rosters: Ref<Rosters> = ref({ [Team.Order]: [], [Team.Chaos]: [] })

let started = false
let failedAttempts = 0
let timer: number | null = null

function rosterSignature(teams: Rosters): string {
  return [Team.Order, Team.Chaos]
    .map((t) =>
      (teams[t] ?? []).map((p) => `${p.alias}#${p.tag}|${p.videoStreamUrl ?? ''}`).join(','),
    )
    .join(';')
}

function publish(teams: Rosters) {
  if (rosterSignature(teams) === rosterSignature(rosters.value)) return
  rosters.value = teams
}

function schedule(delayMs: number, client: LeagueBroadcastClient) {
  if (timer !== null) clearTimeout(timer)
  timer = window.setTimeout(() => refresh(client), delayMs)
}

async function refresh(client: LeagueBroadcastClient) {
  try {
    const game = await client.api.game.getCurrentGame()
    if (!game) throw new Error('no current game')

    const playersInGame = await client.api.game.getPlayersInGame(game.gameId)
    const teams: Rosters = {
      [Team.Order]: playersInGame[Team.Order] ?? [],
      [Team.Chaos]: playersInGame[Team.Chaos] ?? [],
    }

    publish(teams)
    failedAttempts = 0
    schedule(REFRESH_INTERVAL_MS, client)
  } catch (error) {
    failedAttempts++
    if (failedAttempts === 1) {
      console.warn('[PlayerCameras] Roster not available yet, retrying:', error)
    }
    const delay =
      RETRY_DELAYS_MS[Math.min(failedAttempts - 1, RETRY_DELAYS_MS.length - 1)] ?? 30_000
    schedule(delay, client)
  }
}

function ensureStarted(client: LeagueBroadcastClient) {
  if (started) return
  started = true

  // Refresh immediately when connectivity or game state changes; the
  // signature guard in publish() makes redundant refreshes harmless.
  client.onIngameConnect(() => refresh(client))
  client.onIngameStatusChange((status) => {
    if (
      status === GameState.ChampionSelect ||
      status === GameState.Loading ||
      status === GameState.Running ||
      status === GameState.Mocking
    ) {
      refresh(client)
    }
  })

  refresh(client)
}

/** Reactive per-team camera roster. Safe to call from multiple components. */
export function usePlayerCameraRoster(): Ref<Rosters> {
  const client = useClient()
  ensureStarted(client)
  return rosters
}
