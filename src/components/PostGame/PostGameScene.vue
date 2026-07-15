<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useClient } from '@/client'
import {
  useIsPostGameActive,
  usePostGameOverview,
  usePostGameSelector,
} from '@/composables/usePostGame'
import { parsePostGameRoute, type PostGameScreen } from './postgameRoutes'
import PostGameOverview from './PostGameOverview.vue'
import PostGamePlayerAnalysis from './PostGamePlayerAnalysis.vue'
import PostGamePlayerStats from './PostGamePlayerStats.vue'
import PostGameMatchupTable from './PostGameMatchupTable.vue'
import PostGameSeriesOverview from './PostGameSeriesOverview.vue'
import PostGameFearlessDraft from './PostGameFearlessDraft.vue'
import PostGameFearlessTree from './PostGameFearlessTree.vue'
import PostGameCombined from './PostGameCombined.vue'

const isActive = useIsPostGameActive()
const overview = usePostGameOverview()

// Freeze the last known overview so the scene can play its leave transition
// over the final result instead of blanking mid-animation when the backend
// clears post-game data.
const frozenOverview = computed(() => overview.value)

// Whether the caster has an active post-game analysis component selected
// (drives the 'combined' screen and widens the scene's activation gate below
// so the caster-driven screen can appear even before an overview exists).
// The client seeds `activeComponent` from REST on every (re)connect, so the
// store is populated even on pages loaded mid-session.
const activeComponentName = usePostGameSelector(
  (s) => s.postGameData.activeComponent?.componentName,
)
const hasActiveComponent = computed(() => !!activeComponentName.value)

// The backend's mocking-off broadcast only flips `isMocking` — it never clears
// the last mock-selected `activeComponent`, so a stale component would keep the
// scene (combined screen) pinned on screen after mocking stops. Watch the flag
// and reset the post-game store on the true->false transition so the scene
// fades back out to transparent when nothing is genuinely active.
const isMocking = usePostGameSelector((s) => s.postGameData.isMocking)

// -- screen state ------------------------------------------------------------
// Initialise synchronously from URL params (?pgscreen / ?pgplayer) so the very
// first render is already the requested screen (no forced cross-fade on load).
// Applies in both mock and live mode so any screen can be previewed directly.
const VALID_SCREENS: PostGameScreen[] = [
  'overview',
  'player',
  'player-stats',
  'matchup',
  'series',
  'fearless',
  'combined',
  'fearless-tree',
]
function readInitialScreen(): PostGameScreen {
  if (typeof window === 'undefined') return 'overview'
  const s = new URLSearchParams(window.location.search).get('pgscreen') as PostGameScreen | null
  return s && VALID_SCREENS.includes(s) ? s : 'overview'
}
function readInitialPlayer(): number {
  if (typeof window === 'undefined') return 0
  const p = new URLSearchParams(window.location.search).get('pgplayer')
  if (p === null) return 0
  const n = Number(p)
  return Number.isInteger(n) && n >= 0 && n <= 9 ? n : 0
}
function readInitialGame(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const p = new URLSearchParams(window.location.search).get('pggame')
  if (p === null) return undefined
  const n = Number(p)
  return Number.isFinite(n) ? n : undefined
}

const screen = ref<PostGameScreen>(readInitialScreen())
const playerIndex = ref(readInitialPlayer())
const gameId = ref<number | undefined>(readInitialGame())

// The caster-selected active component IS the combined-view driver: unless a
// specific screen was forced via ?pgscreen, show the combined screen whenever
// a component is active (e.g. the backend's post-game mock rotation) and fall
// back to the routed screen when it clears.
const hasExplicitScreen =
  typeof window !== 'undefined' &&
  VALID_SCREENS.includes(
    new URLSearchParams(window.location.search).get('pgscreen') as PostGameScreen,
  )
const effectiveScreen = computed<PostGameScreen>(() =>
  !hasExplicitScreen && hasActiveComponent.value ? 'combined' : screen.value,
)
const shouldShowScene = computed(() =>
  hasExplicitScreen ? isActive.value : hasActiveComponent.value,
)

// -- activation + native route parsing ---------------------------------------
{
  const client = useClient()

  // When the caster deselects the active component (cleared to null), go
  // transparent so the scene does not fall back to the default overview screen.
  // Preserve any explicitly forced screen (?pgscreen) — that is a deliberate
  // preview, not caster output.
  watch(hasActiveComponent, (active, wasActive) => {
    if (wasActive && !active && !hasExplicitScreen) {
      try {
        client.hidePostGame()
      } catch (err) {
        console.debug('[PostGameScene] hidePostGame on component-deselect failed', err)
      }
    }
  })

  // When mocking stops, drop the stale active component / overview so the scene
  // clears instead of holding the last mock screen. Preserve any explicitly
  // forced screen (?pgscreen) — that is a deliberate preview, not mock output.
  watch(isMocking, (mocking, wasMocking) => {
    if (wasMocking && !mocking && !hasExplicitScreen) {
      try {
        client.hidePostGame()
      } catch (err) {
        console.debug('[PostGameScene] hidePostGame on mocking-off failed', err)
      }
    }
  })

  onMounted(() => {
    const params = new URLSearchParams(window.location.search)
    try {
      if (params.has('pggame')) {
        const id = Number(params.get('pggame'))
        if (!Number.isNaN(id)) {
          gameId.value = id
          void client.showPostGame(id)
        }
      } else if (params.has('pgload')) {
        void client.showPostGame()
      }
    } catch (err) {
      // backend may be absent in dev — the scene simply stays hidden
      console.debug('[PostGameScene] showPostGame failed', err)
    }

    client.onPostGameEvents({
      onRouteUpdate: (uri) => {
        console.debug('[PostGameScene] route update', uri)
        const parsed = parsePostGameRoute(uri)
        if (!parsed) return // unrecognised → keep current screen
        if (parsed.screen === 'combined' && !hasExplicitScreen) {
          try {
            client.hidePostGame()
          } catch (err) {
            console.debug('[PostGameScene] hidePostGame on empty route failed', err)
          }
          return
        }
        screen.value = parsed.screen
        if (parsed.gameId !== undefined) gameId.value = parsed.gameId
        if (parsed.playerIndex !== undefined) playerIndex.value = parsed.playerIndex
      },
    })
  })
}
</script>

<template>
  <Transition name="pg-scene" :duration="{ enter: 700, leave: 500 }">
    <div v-if="shouldShowScene" class="postgame-scene">
      <div class="backdrop" />

      <!-- Active screen (cross-fade between screens) -->
      <div class="screen-stage">
        <Transition name="pg-screen" mode="out-in">
          <PostGameOverview
            v-if="effectiveScreen === 'overview' && frozenOverview"
            key="overview"
            :overview="frozenOverview"
          />
          <PostGamePlayerAnalysis
            v-else-if="effectiveScreen === 'player'"
            key="player"
            :game-id="gameId"
            :player-index="playerIndex"
          />
          <PostGamePlayerStats
            v-else-if="effectiveScreen === 'player-stats'"
            key="player-stats"
            :game-id="gameId"
            :player-index="playerIndex"
          />
          <PostGameMatchupTable v-else-if="effectiveScreen === 'matchup'" key="matchup" />
          <PostGameSeriesOverview v-else-if="effectiveScreen === 'series'" key="series" />
          <PostGameFearlessDraft v-else-if="effectiveScreen === 'fearless'" key="fearless" />
          <PostGameCombined v-else-if="effectiveScreen === 'combined'" key="combined" />
          <PostGameFearlessTree
            v-else-if="effectiveScreen === 'fearless-tree'"
            key="fearless-tree"
          />
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.postgame-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Opaque CI backdrop — post game is a full-screen scene, not an overlay over
   game footage: project black with a faint accent floor glow and a soft
   top light so the panels sit on visible depth. */
.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1100px 480px at 50% 108%, rgb(129 117 255 / 0.16), transparent 65%),
    radial-gradient(1400px 700px at 50% -12%, rgb(255 255 255 / 0.05), transparent 60%),
    linear-gradient(to bottom, #131316, #070708);
}

/* Absolute-inset stage the full-bleed screens position themselves inside; the
   overview screen centers its fixed-width content column. */
.screen-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Scene transition ── */
.pg-scene-enter-active {
  transition:
    opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.pg-scene-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}
.pg-scene-enter-from,
.pg-scene-leave-to {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
}

/* ── Screen cross-fade ── */
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
