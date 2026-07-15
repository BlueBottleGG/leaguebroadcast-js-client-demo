import { ref, onUnmounted, type Ref, watch } from 'vue'
import {
  GameState,
  shallowEqual,
  type GameStateSnapshot,
  type ingameFrontendData,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'

/**
 * Reactive Vue wrapper around `client.selectIngame()`.
 * Returns a Vue ref that updates whenever the selected slice of game state changes.
 *
 * @example
 * const kills = useIngameSelector(s => s.gameData.scoreboard?.teams[0]?.kills ?? 0);
 */
export function useIngameSelector<T>(
  selector: (snapshot: GameStateSnapshot) => T,
  equalityFn = shallowEqual,
): Ref<T> {
  const client = useClient()
  const subscribable = client.selectIngame(selector, equalityFn)

  const value = ref(subscribable.getSnapshot()) as Ref<T>
  const unsubscribe = subscribable.subscribe(() => {
    value.value = subscribable.getSnapshot()
  })
  onUnmounted(unsubscribe)

  return value
}

/**
 * Reactive ref of the full in-game data. Updates on every state push.
 * Prefer `useIngameSelector` for fine-grained reactivity.
 */
export function useIngameData(): Ref<ingameFrontendData | undefined> {
  const client = useClient()
  const data = ref<ingameFrontendData | undefined>(client.getIngameData())
  const unsub = client.onIngameStateUpdate((state) => {
    data.value = state
  })
  onUnmounted(unsub)
  return data
}

/** Reactive ref of the current GameState (Running, Paused, etc.). */
export function useGameState(): Ref<GameState> {
  const client = useClient()
  const state = ref(client.getIngameState())
  const unsub = client.onIngameStatusChange((status) => {
    state.value = status
  })
  onUnmounted(unsub)
  return state
}

export function useIsInGame(): Ref<boolean> {
  const gameState = useGameState()
  const isInGame = ref(
    gameState.value === GameState.Running ||
      gameState.value === GameState.Paused ||
      gameState.value === GameState.Mocking,
  )
  const w = watch(gameState, (newState) => {
    isInGame.value =
      newState === GameState.Running ||
      newState === GameState.Paused ||
      newState === GameState.Mocking
  })
  onUnmounted(w)
  return isInGame
}

/** Reactive: whether the backend is in a testing / replay (mock) environment. */
export function useIsTestingEnvironment(): Ref<boolean> {
  const client = useClient()
  const testing = ref(client.isInTestingEnvironment())
  const unsubStatus = client.onIngameStatusChange((_status, isTestingEnv) => {
    testing.value = isTestingEnv
  })
  const unsubState = client.onIngameStateUpdate((state) => {
    if (state.isTestingEnvironment !== undefined) testing.value = state.isTestingEnvironment
  })
  onUnmounted(() => {
    unsubStatus()
    unsubState()
  })
  return testing
}

/** Reactive boolean for whether the in-game WebSocket is connected. */
export function useIngameConnected(): Ref<boolean> {
  const client = useClient()
  const connected = ref(client.isIngameConnected())

  const unsubConnect = client.onIngameConnect(() => {
    connected.value = true
  })
  const unsubDisconnect = client.onIngameDisconnect(() => {
    connected.value = false
  })

  onUnmounted(() => {
    unsubConnect()
    unsubDisconnect()
  })
  return connected
}
