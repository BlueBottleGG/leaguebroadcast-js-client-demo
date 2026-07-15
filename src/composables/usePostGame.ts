import { ref, onUnmounted, type Ref } from 'vue'
import {
  shallowEqual,
  type PostGameSnapshot,
  type postGameStateData,
  type postGameOverview,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'

/**
 * Reactive Vue wrapper around `client.selectPostGame()`.
 * Mirrors `useChampSelectSelector` in useChampSelect.ts so every component
 * stays client-agnostic.
 */
export function usePostGameSelector<T>(
  selector: (snapshot: PostGameSnapshot) => T,
  equalityFn = shallowEqual,
): Ref<T> {
  const client = useClient()
  const subscribable = client.selectPostGame(selector, equalityFn)
  const value = ref(subscribable.getSnapshot()) as Ref<T>
  const unsubscribe = subscribable.subscribe(() => {
    value.value = subscribable.getSnapshot()
  })
  onUnmounted(unsubscribe)
  return value
}

/** Reactive ref of the full post-game data. */
export function usePostGameData(): Ref<postGameStateData> {
  return usePostGameSelector((s) => s.postGameData)
}

/** Reactive boolean for whether post-game is currently active. */
export function useIsPostGameActive(): Ref<boolean> {
  return usePostGameSelector((s) => s.isActive)
}

/** Reactive ref of the post-game overview (null until data arrives). */
export function usePostGameOverview(): Ref<postGameOverview | null> {
  return usePostGameSelector((s) => s.postGameData.overview ?? null)
}

/**
 * Reactive counter that increments whenever the backend reports freshly
 * persisted post-game stats ("postgame-stats-available", client >= 1.5.0).
 * Watch it to re-fetch REST post-game data on already-loaded pages.
 */
export function usePostGameStatsVersion(): Ref<number> {
  return usePostGameSelector((s) => s.postGameData.statsVersion ?? 0)
}
