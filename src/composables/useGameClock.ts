import { onUnmounted, ref, type Ref } from 'vue'
import { shallowEqual, type GameStateSnapshot } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'

/**
 * Extra seconds added to the game clock, to compensate for how long the backend
 * takes to observe a game state before it stamps the snapshot. Transport delay is
 * already corrected via `utcTime`, so this only covers what happens upstream of it.
 * Tune per overlay with `?clockoffset=<seconds>` (negative values run the clock late).
 */
function calibrationSeconds(): number {
  const raw = Number(new URLSearchParams(window.location.search).get('clockoffset'))
  return Number.isFinite(raw) ? raw : 0
}

/**
 * A snapshot older than this is taken as backend/browser wall-clock skew rather than
 * real delay, and is not applied — otherwise a skewed clock throws every timer off.
 */
const MAX_SNAPSHOT_AGE_SECONDS = 2

/** Backwards corrections smaller than this are absorbed, larger ones snap (new game, replay seek). */
const MAX_ABSORBED_REWIND_SECONDS = 1

const clock = ref(0)
let anchorGameTime = 0
let anchorPerf = 0
let speed = 1

let consumers = 0
let frame = 0
let unsubscribe: (() => void) | null = null

function selectSync(s: GameStateSnapshot) {
  return {
    gameTime: s.gameData.scoreboard?.gameTime ?? s.gameData.gameTime ?? 0,
    utcTime: s.gameData.utcTime,
    // Mirrors the library: a paused game reports speed 0, which freezes the clock.
    playbackSpeed: s.gameData.playbackSpeed ?? 1,
  }
}

function readClock(): number {
  return anchorGameTime + ((performance.now() - anchorPerf) / 1000) * speed
}

function rebase(sync: ReturnType<typeof selectSync>) {
  speed = sync.playbackSpeed
  const age =
    sync.utcTime == null
      ? 0
      : Math.min(Math.max(0, (Date.now() - sync.utcTime) / 1000), MAX_SNAPSHOT_AGE_SECONDS)
  const synced = sync.gameTime + (age + calibrationSeconds()) * speed
  // Transport jitter must not rewind the clock, or countdown text flickers between
  // two values every time a snapshot lands a few milliseconds later than the last.
  const rewind = readClock() - synced
  anchorGameTime = rewind > 0 && rewind < MAX_ABSORBED_REWIND_SECONDS ? readClock() : synced
  anchorPerf = performance.now()
  clock.value = anchorGameTime
}

function tick() {
  clock.value = readClock()
  frame = requestAnimationFrame(tick)
}

/**
 * Game time in seconds, advanced continuously against `performance.now()`.
 *
 * `gameData.gameTime` is not usable for countdowns: the client library steps it once per
 * second off a free-running interval and only re-syncs it once it has drifted more than
 * two seconds, so anything derived from it renders visibly late. This anchors instead to
 * the one game time the library leaves untouched — `scoreboard.gameTime`, as observed at
 * `utcTime` — corrects it for the age of that snapshot, and interpolates from there.
 *
 * The ref changes every frame, so read it through a computed that is quantized to what is
 * actually visible (whole degrees of sweep, whole seconds). A template that reads it
 * directly re-renders 60 times a second whether or not anything moved.
 */
export function useGameClock(): Ref<number> {
  if (consumers++ === 0) {
    const slice = useClient().selectIngame(selectSync, shallowEqual)
    rebase(slice.getSnapshot())
    unsubscribe = slice.subscribe(() => rebase(slice.getSnapshot()))
    frame = requestAnimationFrame(tick)
  }

  onUnmounted(() => {
    if (--consumers === 0) {
      cancelAnimationFrame(frame)
      unsubscribe?.()
      unsubscribe = null
    }
  })

  return clock
}
