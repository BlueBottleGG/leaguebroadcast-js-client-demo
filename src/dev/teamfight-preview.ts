/**
 * Dev-only preview harness for the TeamfightRecap overlay.
 * Mounts the real components against a fake client with scripted backend data
 * so both damage graph triggers can be screenshotted without a game.
 *
 * Usage: /teamfight-preview.html
 *   view=recap|damage|both|compact — which graph gets data (default both);
 *                    compact shows only the live CompactTeamfight bar, at its
 *                    production position (the bar is always fed; the other
 *                    views just lift it above the panels)
 *   kills=<n>      — number of kills represented in the recap fixture
 *   enterAfter=<s> — delay before the data appears, to watch the enter
 *                    transition (default 0.5s)
 *   hideAfter=<s>  — clear the data after this many seconds to watch the
 *                    leave transition (default: never)
 *
 * Not part of the production build (vite only builds index.html).
 */
import { createApp } from 'vue'
import '@/style.css'
import { GameState, Team, type simpleChampionData } from '@bluebottle_gg/league-broadcast-client'
import { ClientKey } from '@/client'
import {
  buildDemoTimeline,
  buildDemoDamageGraph,
  buildDemoTeamfightOverview,
} from './teamfightDemoData'
import TeamfightRecapPreview from './TeamfightRecapPreview.vue'

const params = new URLSearchParams(window.location.search)
const view = params.get('view') ?? 'both'
const killCount = Number(params.get('kills')) || 5
const enterAfter = (Number(params.get('enterAfter')) || 0.5) * 1000
const hideAfter = Number(params.get('hideAfter')) * 1000 || undefined

// Champion square icons off ddragon so the preview needs no backend cache.
const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion'
function champ(alias: string, name = alias): simpleChampionData {
  return {
    id: 0,
    alias,
    name,
    splashCenteredImg: '',
    splashImg: '',
    loadingImg: '',
    squareImg: `${DDRAGON}/${alias}.png`,
    tileImg: '',
  }
}

const blue = ['Ahri', 'LeeSin', 'Jinx', 'Thresh', 'Ornn']
const red = ['Syndra', 'Viego', 'Aphelios', 'Nautilus', 'KSante']
const fighters = [
  ...blue.map((c) => ({ champion: champ(c), team: Team.Order })),
  ...red.map((c) => ({ champion: champ(c), team: Team.Chaos })),
]

const state: { gameState: GameState; gameData: Record<string, unknown> } = {
  gameState: GameState.Running,
  gameData: {
    gameTime: 1300,
    teamfightTimeline: undefined,
    damageGraph: undefined,
    // TeamfightPlayerEntry (rendered via CompactTeamfight) is only driven by
    // teamfightDamageOverview, not damageGraph — it gets its own fixture so
    // the baron/elder buff-border indicator is exercised in this preview too.
    teamfightDamageOverview: undefined,
  },
}

const listeners = new Set<() => void>()

/* eslint-disable @typescript-eslint/no-explicit-any */
const fakeClient: any = {
  selectIngame(selector: (s: any) => unknown) {
    return {
      getSnapshot: () => selector(state),
      subscribe(cb: () => void) {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
    }
  },
  getIngameData: () => undefined,
  getCacheUrl: (url: string) => url,
  getGameTime: () => state.gameData.gameTime,
}
/* eslint-enable @typescript-eslint/no-explicit-any */

setTimeout(() => {
  if (view !== 'damage' && view !== 'compact') {
    state.gameData.teamfightTimeline = buildDemoTimeline(fighters, killCount)
  }
  if (view !== 'recap' && view !== 'compact') {
    state.gameData.damageGraph = buildDemoDamageGraph(fighters)
  }
  // Separate feed (see above), so it is populated in every view — that is what
  // exercises the compact bar's baron/elder buff border.
  state.gameData.teamfightDamageOverview = buildDemoTeamfightOverview(fighters)
  listeners.forEach((cb) => cb())
}, enterAfter)

if (hideAfter) {
  setTimeout(() => {
    state.gameData.teamfightTimeline = undefined
    state.gameData.damageGraph = undefined
    state.gameData.teamfightDamageOverview = undefined
    listeners.forEach((cb) => cb())
  }, enterAfter + hideAfter)
}

const app = createApp(TeamfightRecapPreview)
app.provide(ClientKey, fakeClient)
app.mount('#app')
