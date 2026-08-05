import { onUnmounted, ref, type Ref } from 'vue'
import { useClient } from '@/client'

/**
 * Extra seconds added to the game clock, to compensate for how long the backend
 * takes to observe a game state before it stamps the snapshot. Transport delay is
 * already corrected by the client library via `utcTime`, so this only covers what
 * happens upstream of it.
 * Tune per overlay with `?clockoffset=<seconds>` (negative values run the clock late).
 */
function calibrationSeconds(): number {
  const raw = Number(new URLSearchParams(window.location.search).get('clockoffset'))
  return Number.isFinite(raw) ? raw : 0
}

const clock = ref(0)
let consumers = 0
let frame = 0

/**
 * Game time in seconds, sampled once per animation frame.
 *
 * `client.getGameTime()` interpolates from the most recent backend snapshot, so it stays
 * accurate between updates; this only turns it into something Vue can track. Read it
 * through a computed that is quantized to what is actually visible (whole degrees of
 * sweep, whole seconds). A template that reads it directly re-renders 60 times a second
 * whether or not anything moved.
 */
export function useGameClock(): Ref<number> {
  const client = useClient()

  if (consumers++ === 0) {
    const tick = () => {
      clock.value = client.getGameTime() + calibrationSeconds()
      frame = requestAnimationFrame(tick)
    }
    tick()
  }

  onUnmounted(() => {
    if (--consumers === 0) {
      cancelAnimationFrame(frame)
    }
  })

  return clock
}
