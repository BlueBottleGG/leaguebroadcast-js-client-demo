/**
 * Dev-only preview harness for the ObjectivePowerPlay overlay.
 * Mounts the real components against a fake client with mock data so the
 * intro / active / completion states can be screenshotted without a game.
 *
 * Usage: /powerplay-preview.html?scenario=active|ending
 *   active — power plays run for minutes (steady state)
 *   ending — power plays end 5s after load (intro -> active -> completion outro)
 *
 * Scoreboard layout knobs (combine freely):
 *   icons=both|blue|none — team icons on both sides, blue only, or hidden
 *   names=long          — long team tags / info texts
 *   lead=blue|red|even  — which side gets the gold-diff badge
 *
 * Dragon buff banner:
 *   drake=<type>[:delaySeconds] — push a drake kill onto blue's dragons after
 *   the delay (default 2s), e.g. drake=earth or drake=elder:5
 *   dragons=<a,b,c> — set blue's initial dragons list outright,
 *   e.g. dragons=fire,air,earth,water,elder,elder
 *   dragonsRed=<a,b,c> — same for red
 *
 * Not part of the production build (vite only builds index.html).
 */
import { createApp } from 'vue'
import '@/style.css'
import { GameState } from '@bluebottle_gg/league-broadcast-client'
import { ClientKey } from '@/client'
import PowerPlayPreview from './PowerPlayPreview.vue'
import blueIcon from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import redIcon from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'

const params = new URLSearchParams(window.location.search)
const scenario = params.get('scenario') ?? 'ending'
const icons = params.get('icons') ?? 'none'
const longNames = params.get('names') === 'long'
const lead = params.get('lead') ?? 'blue'

const t0 = 1234 // starting game time in seconds

const ppEndOffset = scenario === 'ending' ? 5 : 300

function powerPlay(gold: number) {
  return { timeStart: t0 - 40, timeEnd: t0 + ppEndOffset, gold }
}

const blueGold = lead === 'red' ? 31200 : lead === 'even' ? 31200 : 34500
const redGold = lead === 'red' ? 34500 : 31200

const state: any = {
  gameState: GameState.Running,
  gameData: {
    gameTime: t0,
    scoreboard: {
      gameTime: t0,
      bestOf: 3,
      teams: [
        {
          teamTag: longNames ? 'SKGW' : 'SKG',
          infoText: longNames ? 'Blue Side Academy Roster' : 'Blue Side',
          teamIconUrl: icons === 'both' || icons === 'blue' ? blueIcon : undefined,
          gold: blueGold,
          kills: 14,
          towers: 6,
          grubs: 4,
          dragons: params.get('dragons')?.split(',').filter(Boolean) ?? ['fire', 'air'],
          seriesScore: { wins: 1 },
          baronPowerPlay: powerPlay(1850),
          dragonPowerPlay: powerPlay(720),
        },
        {
          teamTag: longNames ? 'RED SIDE' : 'RED',
          infoText: longNames ? 'Red Side Academy Roster' : 'Red Side',
          teamIconUrl: icons === 'both' ? redIcon : undefined,
          gold: redGold,
          kills: 9,
          towers: 4,
          grubs: 2,
          dragons: params.get('dragonsRed')?.split(',').filter(Boolean) ?? ['water'],
          seriesScore: { wins: 0 },
          baronPowerPlay: undefined,
          dragonPowerPlay: powerPlay(-430),
        },
      ],
    },
    scoreboardBottom: {
      teams: [{ players: [] }, { players: [] }],
    },
  },
}

const listeners = new Set<() => void>()

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
  getCacheUrl: (url: string) => url,
  getGameTime: () => state.gameData.gameTime,
}

setInterval(() => {
  state.gameData.gameTime += 0.25
  state.gameData.scoreboard.gameTime += 0.25
  listeners.forEach((cb) => cb())
}, 250)

// Simulate a drake kill: replace (not mutate) the array like a real state push.
const drake = params.get('drake')
if (drake) {
  const [type, delay] = drake.split(':')
  setTimeout(
    () => {
      const team = state.gameData.scoreboard.teams[0]
      team.dragons = [...team.dragons, type]
      listeners.forEach((cb) => cb())
    },
    (Number(delay) || 2) * 1000,
  )
}

const app = createApp(PowerPlayPreview)
app.provide(ClientKey, fakeClient)
app.mount('#app')
