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

/** `?camtest=<prefix>` on the overlay URL rewires all camera URLs to dummy streams. */
export interface CameraTestConfig {
  prefix: string
  count: number
  server: string
  /** `camicon=<url>` — fallback portrait for every dummy player, to exercise
   *  the icon-fallback rendering without a backend. Full http(s) URLs only. */
  iconUrl?: string
}

export function getCameraTestConfig(): CameraTestConfig | null {
  const params = new URLSearchParams(window.location.search)
  const prefix = params.get('camtest')
  if (!prefix) return null
  return {
    prefix,
    count: Number(params.get('camcount') ?? 10) || 10,
    server: params.get('camserver') ?? 'https://vdo.ninja',
    iconUrl: params.get('camicon') ?? undefined,
  }
}

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

function testStreamUrl(config: CameraTestConfig, index: number): string {
  return `${config.server}/?view=${config.prefix}${index + 1}`
}

/** Stand-in roster so the overlay can be exercised without a backend/game. */
function dummyRoster(config: CameraTestConfig): Rosters {
  const perTeam = Math.ceil(config.count / 2)
  const make = (team: Team, count: number, offset: number): teamMember[] =>
    Array.from({ length: count }, (_, i) => {
      const n = offset + i
      return {
        memberId: -1 - n,
        teamId: team,
        alias: `${config.prefix}${n + 1}`,
        puuid: '',
        isActive: true,
        tag: 'TEST',
        role: 1,
        familyName: '',
        givenName: '',
        displayName: `CAM ${n + 1}`,
        videoStreamUrl: testStreamUrl(config, n),
        iconUri: config.iconUrl,
      } as teamMember
    })
  return {
    [Team.Order]: make(Team.Order, perTeam, 0),
    [Team.Chaos]: make(Team.Chaos, config.count - perTeam, perTeam),
  }
}

/** Placeholder roster for a mocked game: the backend reports a testing
 *  environment but often has no current game / players configured. The
 *  camera boxes then show these stand-ins (PlayerCamera maps them to the
 *  bundled sample portraits) instead of staying empty. */
function mockRoster(): Rosters {
  const make = (team: Team, count: number): teamMember[] =>
    Array.from({ length: count }, (_, i) => {
      return {
        memberId: -100 - team * 10 - i,
        teamId: team,
        alias: `mock${i + 1}`,
        puuid: '',
        isActive: true,
        tag: 'MOCK',
        role: 1,
        familyName: '',
        givenName: '',
        displayName: `PLAYER ${i + 1}`,
      } as teamMember
    })
  return { [Team.Order]: make(Team.Order, 3), [Team.Chaos]: make(Team.Chaos, 3) }
}

function isEmpty(teams: Rosters): boolean {
  return rosterSignature(teams) === rosterSignature({ [Team.Order]: [], [Team.Chaos]: [] })
}

function applyCameraTestOverride(teams: Rosters, config: CameraTestConfig): Rosters {
  let index = 0
  const result: Rosters = { [Team.Order]: [], [Team.Chaos]: [] }
  for (const team of [Team.Order, Team.Chaos]) {
    result[team] = (teams[team] ?? []).map((p) => {
      const url = index < config.count ? testStreamUrl(config, index) : undefined
      index++
      return { ...p, videoStreamUrl: url, iconUri: config.iconUrl ?? p.iconUri } as teamMember
    })
  }
  return result
}

function publish(teams: Rosters) {
  if (rosterSignature(teams) === rosterSignature(rosters.value)) return
  rosters.value = teams
}

/* The client's own isInTestingEnvironment() only updates on status-change
   events; the flag usually arrives on state pushes. Track both sources. */
let testingEnv = false
function noteTestingEnv(value: boolean | undefined, client: LeagueBroadcastClient) {
  if (value === undefined || value === testingEnv) return
  testingEnv = value
  if (value && isEmpty(rosters.value)) refresh(client)
}

function isTestingEnv(client: LeagueBroadcastClient): boolean {
  return testingEnv || client.isInTestingEnvironment()
}

function schedule(delayMs: number, client: LeagueBroadcastClient) {
  if (timer !== null) clearTimeout(timer)
  timer = window.setTimeout(() => refresh(client), delayMs)
}

async function refresh(client: LeagueBroadcastClient) {
  const testConfig = getCameraTestConfig()
  try {
    const game = await client.api.game.getCurrentGame()
    if (!game) throw new Error('no current game')

    const playersInGame = await client.api.game.getPlayersInGame(game.gameId)
    let teams: Rosters = {
      [Team.Order]: playersInGame[Team.Order] ?? [],
      [Team.Chaos]: playersInGame[Team.Chaos] ?? [],
    }
    if (testConfig) teams = applyCameraTestOverride(teams, testConfig)

    // A mocked game may exist without any players configured — show the
    // placeholder roster rather than empty boxes.
    if (isEmpty(teams) && isTestingEnv(client)) teams = mockRoster()

    publish(teams)
    failedAttempts = 0
    schedule(REFRESH_INTERVAL_MS, client)
  } catch (error) {
    failedAttempts++
    if (failedAttempts === 1) {
      console.warn('[PlayerCameras] Roster not available yet, retrying:', error)
    }
    if (testConfig && isEmpty(rosters.value)) {
      publish(dummyRoster(testConfig))
    } else if (isEmpty(rosters.value) && isTestingEnv(client)) {
      // Mocking without a configured game (`game/current` 404s): fall back
      // to the placeholder roster so the camera boxes show the real look.
      publish(mockRoster())
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
  client.onIngameStatusChange((status, isTestingEnvironment) => {
    noteTestingEnv(isTestingEnvironment, client)
    if (
      status === GameState.ChampionSelect ||
      status === GameState.Loading ||
      status === GameState.Running ||
      status === GameState.Mocking
    ) {
      refresh(client)
    }
  })
  client.onIngameStateUpdate((state) => noteTestingEnv(state.isTestingEnvironment, client))

  refresh(client)
}

/** Reactive per-team camera roster. Safe to call from multiple components. */
export function usePlayerCameraRoster(): Ref<Rosters> {
  const client = useClient()
  ensureStarted(client)
  return rosters
}
