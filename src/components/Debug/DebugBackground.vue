<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { GameState } from '@bluebottle_gg/league-broadcast-client'
import { useGameState, useIsTestingEnvironment } from '@/composables/useIngame'
import { useIsChampSelectActive } from '@/composables/useChampSelect'

/**
 * Optional `?bg=` debug background for overlay routes, dev builds only (a
 * no-op in production so a leftover `?bg=` in an OBS source URL can't paint
 * over the game feed). The default stays transparent (OBS browser source);
 * pass a value while debugging in a normal browser tab:
 *   bg=game    — neutral game-like gradient
 *   bg=pregame — neutral studio-like gradient
 *   bg=dark    — flat dark
 *   bg=<any CSS color> — e.g. bg=green or bg=%23202833
 *   bg=none    — force transparent
 * While the backend mocks / replays a game (dev builds) the gameplay clip
 * shows automatically — or the studio still during a mocked champ select;
 * pass any bg= value to override that.
 */

/* Stand-in gradient while the clip loads, and in prod builds (which exclude it). */
const GAME_BG = 'linear-gradient(160deg, #26344a 0%, #151a21 60%, #10131a 100%)'
const PREGAME_BG =
  'radial-gradient(circle at 50% 38%, rgb(129 117 255 / 0.2), transparent 34%), linear-gradient(160deg, #171a28, #090a10)'

const route = useRoute()
const gameState = useGameState()
const isTestingEnv = useIsTestingEnvironment()
const isChampSelectActive = useIsChampSelectActive()

const bg = computed(() => {
  // Dev-only: a leftover ?bg= in a production OBS source URL must never
  // paint over the game feed, so the whole component is a no-op in prod builds.
  if (!import.meta.env.DEV) return ''

  // Accept ?bg= in the hash query (.../#/?bg=dark) or the page search string
  // (.../?bg=dark); with hash routing the router only sees the former, so read
  // window.location.search too and the override works wherever it's placed.
  const fromRoute = typeof route.query.bg === 'string' ? route.query.bg : ''
  const fromSearch = new URLSearchParams(window.location.search).get('bg') ?? ''
  const param = fromRoute || fromSearch
  if (param) return param === 'none' || param === 'off' ? '' : param
  // during a draft the broadcast shows the studio scene, not gameplay
  if (isChampSelectActive.value) return 'pregame'
  // A running mock game reports a regular Running state plus the testing-env
  // flag; the Mocking state only covers the idle phase between mock games.
  if (isTestingEnv.value || gameState.value === GameState.Mocking) return 'game'
  return ''
})

const style = computed(() => {
  if (!bg.value) return undefined
  if (bg.value === 'game') return { background: GAME_BG }
  if (bg.value === 'pregame') return { background: PREGAME_BG }
  if (bg.value === 'dark') return { background: '#10131a' }
  return { background: bg.value }
})
</script>

<template>
  <div v-if="style" class="debug-bg" :style="style" />
</template>

<style scoped>
/* Rendered as the first child of .overlay: absolutely positioned siblings
   paint in DOM order, so this stays behind every element without z-index. */
.debug-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
