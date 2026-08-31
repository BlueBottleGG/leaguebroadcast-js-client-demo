/**
 * Dev-only preview harness for the GoldGraph overlay.
 * Mounts the real component against a fake client that replays a seeded
 * random-walk gold series, so the rescale/reveal animations and extrema
 * labels can be inspected without a game.
 *
 * Usage: /goldgraph-preview.html
 *   points=<n>      — initial number of samples (default 36 ≈ 18 min at 30s)
 *   interval=<ms>   — how often a new sample is appended (default 2000; 0 = never)
 *   seed=<n>        — RNG seed for the gold walk (default 7)
 *   variant=player-scoreboard — graph-only layout in the bottom scoreboard slot
 *
 * The full state is re-pushed to subscribers 4×/s with an unchanged series
 * between appends — exactly like production — so this also verifies the
 * graph does NOT re-animate on identical snapshots.
 *
 * Not part of the production build (vite only builds index.html).
 */
import { createApp } from 'vue'
import '@/style.css'
import { ClientKey } from '@/client'
import GoldGraphPreview from './GoldGraphPreview.vue'
import blueIcon from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import redIcon from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'

const params = new URLSearchParams(window.location.search)
const initialPoints = Number(params.get('points') ?? 36)
const appendInterval = Number(params.get('interval') ?? 2000)
const seed = Number(params.get('seed') ?? 7)

// Deterministic RNG (mulberry32) so runs are reproducible per seed
let rngState = seed >>> 0
function rand(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0
  let t = rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Random-walk gold diff with drifting momentum — floats on purpose. */
let diff = 0
let momentum = 0
function nextDiff(): number {
  momentum += (rand() - 0.5) * 220
  momentum *= 0.9
  diff += momentum + (rand() - 0.5) * 180
  return diff
}

const SAMPLE_STEP = 30 // seconds of game time per sample
const goldAtTime: Record<number, Record<number, number>> = {}
let sampleCount = 0

function appendSample() {
  const t = sampleCount * SAMPLE_STEP
  const d = sampleCount === 0 ? 0 : nextDiff()
  const base = 2500 + t * 62.5 // typical total team gold curve
  goldAtTime[t] = { 0: base + d / 2, 1: base - d / 2 }
  sampleCount++
}

for (let i = 0; i < initialPoints; i++) appendSample()

function completedGame(
  duration: number,
  teams: Record<number, string>,
  winner: number,
  advantage: number,
) {
  const samples: Record<number, Record<number, number>> = {}
  for (let time = 0; time <= duration; time += 60) {
    const progress = time / duration
    const diff = advantage * progress + Math.sin(progress * Math.PI * 4) * 900
    const base = 2500 + time * 62.5
    samples[time] = { 0: base + diff / 2, 1: base - diff / 2 }
  }
  return { goldAtTime: samples, teams, winner, events: [], teamfights: [] }
}

const previousGames = [
  // The teams swapped sides in game one: TEL won there, but is red in the current game.
  completedGame(1680, { 0: 'TEL', 1: 'SKG' }, 0, 4200),
  completedGame(2040, { 0: 'SKG', 1: 'TEL' }, 0, 3100),
]

const state: any = {
  gameData: {
    gameTime: (initialPoints - 1) * SAMPLE_STEP,
    scoreboard: {
      teams: [
        { teamTag: 'SKG', teamIconUrl: blueIcon },
        { teamTag: 'TEL', teamIconUrl: redIcon },
      ],
    },
    goldGraph: {
      current: { goldAtTime: { ...goldAtTime }, teams: { 0: 'SKG', 1: 'TEL' } },
      previousGames,
      showPreviousGames: true,
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

// Production cadence: state pushes 4×/s, series unchanged between appends.
setInterval(() => {
  state.gameData.gameTime += 0.25
  listeners.forEach((cb) => cb())
}, 250)

// Append a fresh sample (new object identity, like a real state push)
if (appendInterval > 0) {
  setInterval(() => {
    appendSample()
    state.gameData.goldGraph = {
      current: { goldAtTime: { ...goldAtTime }, teams: { 0: 'SKG', 1: 'TEL' } },
      previousGames,
      showPreviousGames: true,
    }
    listeners.forEach((cb) => cb())
  }, appendInterval)
}

const app = createApp(GoldGraphPreview)
app.provide(ClientKey, fakeClient)
app.mount('#app')
