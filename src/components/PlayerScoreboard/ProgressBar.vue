<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    progressPct?: number
    fillColor?: string
    mirror?: boolean
    /** When true, the fill snaps to progressPct instantly instead of animating (e.g. on player switch). */
    noTransition?: boolean
  }>(),
  {
    progressPct: 0,
    fillColor: '#FFFFFF',
    mirror: false,
    noTransition: false,
  },
)

// Callers derive the percentage from live game data, which can go out of range (XP at max level
// divides by a zero span -> Infinity; current can exceed max after a shield/level tick). Clamp here
// so no caller can push a fill past the track, and drop non-finite values to 0.
const clampedPct = computed(() => {
  const pct = props.progressPct
  if (!Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, pct))
})
</script>

<template>
  <div
    class="progress-bar-track"
    :style="{
      'background-color': 'color-mix(in srgb, ' + fillColor + ' 50%, rgba(0, 0, 0, 0.5))',
      '--progress-pct': clampedPct + '%',
    }"
  >
    <div
      class="h-full"
      :style="{
        'background-color': fillColor,
        width: 'var(--progress-pct)',
        transition: noTransition ? 'none' : 'width 0.5s ease-in-out',
        //start from the right if mirror is true
      }"
      :class="mirror ? 'ml-auto' : 'mr-auto'"
    ></div>
  </div>
</template>

<style lang="css" scoped>
/* Second line of defense next to the clamp: the fill can never paint outside the track. */
.progress-bar-track {
  overflow: hidden;
}
</style>
