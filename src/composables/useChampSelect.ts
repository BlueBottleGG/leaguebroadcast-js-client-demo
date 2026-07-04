import { ref, onUnmounted, type Ref } from 'vue'
import {
  shallowEqual,
  TeamMemberRole,
  type ChampSelectSnapshot,
  type champSelectStateData,
  type championSelectTeam,
  type teamMember,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import {
  isMockCsEnabled,
  mockSnapshot,
  subscribeMock,
  startMockSimulation,
} from '@/components/ChampionSelect/mock/mockChampSelect'

/**
 * Reactive Vue wrapper around `client.selectChampSelect()`.
 * In dev mock mode (`?mockcs`) the selector reads from the local mock
 * snapshot so every component stays client-agnostic.
 */
export function useChampSelectSelector<T>(
  selector: (snapshot: ChampSelectSnapshot) => T,
  equalityFn = shallowEqual,
): Ref<T> {
  if (isMockCsEnabled()) {
    startMockSimulation()
    const value = ref(selector(mockSnapshot())) as Ref<T>
    const unsub = subscribeMock(() => {
      const next = selector(mockSnapshot())
      if (!equalityFn(value.value, next)) value.value = next
    })
    onUnmounted(unsub)
    return value
  }

  const client = useClient()
  const subscribable = client.selectChampSelect(selector, equalityFn)
  const value = ref(subscribable.getSnapshot()) as Ref<T>
  const unsubscribe = subscribable.subscribe(() => {
    value.value = subscribable.getSnapshot()
  })
  onUnmounted(unsubscribe)
  return value
}

/** Reactive ref of the full champ-select data. */
export function useChampSelectData(): Ref<champSelectStateData> {
  return useChampSelectSelector((s) => s.champSelectData)
}

/** Reactive boolean for whether champion select is currently active. */
export function useIsChampSelectActive(): Ref<boolean> {
  return useChampSelectSelector((s) => s.isActive)
}

const PUUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function looksLikePuuid(v?: string): boolean {
  return !!v && PUUID_RE.test(v.trim())
}

function memberDisplay(m: teamMember): string {
  return (
    m.displayName ||
    m.alias ||
    [m.givenName, m.familyName].filter(Boolean).join(' ') ||
    ''
  ).trim()
}

/**
 * Resolve a pick slot's display name. `slot.player` is a puuid on real data,
 * so match against team members; fall back to a non-puuid raw value, else
 * "Player N".
 */
export function resolvePlayerName(
  team: championSelectTeam | undefined,
  player: string | undefined,
  index: number,
): string {
  const members = team?.metaData?.members ?? []
  if (player) {
    const match = members.find((m) => m.puuid && m.puuid === player)
    if (match) {
      const name = memberDisplay(match)
      if (name) return name
    }
    if (!looksLikePuuid(player)) return player
  }
  return `Player ${index + 1}`
}

// the backend serializes roles as strings ("Coach"); the enum is numeric
function isCoachRole(role: unknown): boolean {
  if (typeof role === 'string') return role.toLowerCase() === 'coach'
  return role === TeamMemberRole.Coach
}

/** Coach members (Coach role) of a team, in member order. */
export function resolveCoaches(team: championSelectTeam | undefined): string[] {
  return (team?.metaData?.members ?? [])
    .filter((m) => isCoachRole(m.role))
    .map(memberDisplay)
    .filter((n) => n.length > 0)
}

/**
 * Smooth client-side countdown. Server pushes arrive at their own cadence;
 * a rAF clock interpolates between them and re-anchors only on real
 * deviation (phase reset) or when pushes stop changing (pause) — so the
 * displayed value never stutters or leaps with the push rate.
 */
export function useSmoothCountdown(get: () => number): Ref<number> {
  const value = ref(Math.max(0, get()))
  let anchorValue = value.value
  let anchorT = performance.now()
  let lastTarget = get()
  let lastTargetT = anchorT
  let raf = 0

  const tick = () => {
    const now = performance.now()
    const target = Math.max(0, get())
    if (target !== lastTarget) {
      lastTarget = target
      lastTargetT = now
    }
    const predicted = anchorValue - (now - anchorT) / 1000
    const paused = now - lastTargetT > 1500
    if (paused || Math.abs(predicted - target) > 0.9) {
      anchorValue = target
      anchorT = now
    }
    value.value = Math.max(0, anchorValue - (now - anchorT) / 1000)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  onUnmounted(() => cancelAnimationFrame(raf))
  return value
}

/** Reactive boolean for whether the pre-game WebSocket is connected. */
export function usePreGameConnected(): Ref<boolean> {
  if (isMockCsEnabled()) {
    return ref(true)
  }
  const client = useClient()
  const connected = ref(client.isPreGameConnected())
  const unsubConnect = client.onPreGameConnect(() => {
    connected.value = true
  })
  const unsubDisconnect = client.onPreGameDisconnect(() => {
    connected.value = false
  })
  onUnmounted(() => {
    unsubConnect()
    unsubDisconnect()
  })
  return connected
}
