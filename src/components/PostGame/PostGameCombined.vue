<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import type { activeComponentChangedEventArgs } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { usePostGameSelector, usePostGameOverview } from '@/composables/usePostGame'
import PostGameOverview from './PostGameOverview.vue'
import PostGamePlayerAnalysis from './PostGamePlayerAnalysis.vue'
import PostGamePlayerStats from './PostGamePlayerStats.vue'
import PostGameMatchupTable from './PostGameMatchupTable.vue'
import PostGameSeriesOverview from './PostGameSeriesOverview.vue'
import PostGameFearlessTree from './PostGameFearlessTree.vue'

/**
 * Caster-driven "combined" meta screen: renders whichever post-game component
 * the operator has currently selected on the backend (`postGameData.activeComponent`,
 * set via the `active-component-changed` WS message), cross-fading between
 * components exactly like the shell's screen transition.
 *
 * componentName → component mapping (per the backend contract):
 *   postgame-game          → PostGameOverview
 *   postgame-player        → PostGamePlayerAnalysis
 *   postgame-player-stats  → PostGamePlayerStats
 *   matchup-full           → PostGameMatchupTable
 *   matchup-current        → PostGameSeriesOverview
 *   fearless-bans          → PostGameFearlessTree
 * Unknown / null componentName renders nothing (fully transparent for OBS).
 */

const VALID_COMPONENT_NAMES = [
  'postgame-game',
  'postgame-player',
  'postgame-player-stats',
  'matchup-full',
  'matchup-current',
  'fearless-bans',
] as const
type ComponentName = (typeof VALID_COMPONENT_NAMES)[number]

function isValidComponentName(name?: string | null): name is ComponentName {
  return !!name && (VALID_COMPONENT_NAMES as readonly string[]).includes(name)
}

const overview = usePostGameOverview()

// Reactive store selector — the client seeds `activeComponent` from the REST
// API on every (re)connect, so no manual fetch fallback is needed.
const active = usePostGameSelector<activeComponentChangedEventArgs | null>(
  (s) => s.postGameData.activeComponent ?? null,
)

// If the caster is driving the overview component, make sure the store holds
// the overview for *that* game: load it when missing and re-load when the
// caster selects a different game. showPostGame() fetches the mock overview
// itself when the backend is mocking — `isMocking` is seeded from REST on
// connect, so the flag is reliable even on pages loaded mid-session.
// (Stats updates for the already-loaded game are handled by the client, which
// re-fetches the active overview on "postgame-stats-available".)
{
  const client = useClient()
  let requestedGameKey: string | null = null
  const maybeLoadOverview = async () => {
    const a = active.value
    if (a?.componentName !== 'postgame-game') return
    const gameKey = String(a.gameId ?? 'current')
    if (requestedGameKey === gameKey && overview.value) return
    requestedGameKey = gameKey
    try {
      await client.showPostGame(a.gameId)
    } catch (err) {
      console.debug('[PostGameCombined] overview load failed', err)
      // Allow a retry the next time the active component changes.
      requestedGameKey = null
    }
  }
  onMounted(maybeLoadOverview)
  watch(active, maybeLoadOverview)
}

const componentName = computed<ComponentName | null>(() => {
  const name = active.value?.componentName
  return isValidComponentName(name) ? name : null
})
const gameId = computed(() => active.value?.gameId)
const playerIndex = computed(() => active.value?.playerIndex ?? 0)

const screenKey = computed(
  () => `${componentName.value ?? 'none'}-${gameId.value ?? 'none'}-${playerIndex.value}`,
)
</script>

<template>
  <div class="pg-combined">
    <Transition name="pg-screen" mode="out-in">
      <PostGameOverview
        v-if="componentName === 'postgame-game'"
        :key="screenKey"
        :overview="overview"
      />
      <PostGamePlayerAnalysis
        v-else-if="componentName === 'postgame-player'"
        :key="screenKey"
        :game-id="gameId"
        :player-index="playerIndex"
      />
      <PostGamePlayerStats
        v-else-if="componentName === 'postgame-player-stats'"
        :key="screenKey"
        :game-id="gameId"
        :player-index="playerIndex"
      />
      <PostGameMatchupTable v-else-if="componentName === 'matchup-full'" :key="screenKey" />
      <PostGameSeriesOverview v-else-if="componentName === 'matchup-current'" :key="screenKey" />
      <PostGameFearlessTree v-else-if="componentName === 'fearless-bans'" :key="screenKey" />
    </Transition>
  </div>
</template>

<style scoped>
.pg-combined {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Screen cross-fade (mirrors PostGameScene's .pg-screen transition) ── */
.pg-screen-enter-active,
.pg-screen-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.pg-screen-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.pg-screen-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
