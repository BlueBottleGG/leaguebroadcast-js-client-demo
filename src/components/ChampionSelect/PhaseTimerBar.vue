<script setup lang="ts">
import { computed } from 'vue'
import { useSmoothCountdown } from '@/composables/useChampSelect'

const props = defineProps<{
  timeRemaining: number
  phaseDuration: number
  activeSide: 'blue' | 'red' | null
}>()

const smoothTime = useSmoothCountdown(() => props.timeRemaining)
const pct = computed(() => {
  if (!props.phaseDuration) return 0
  return Math.max(0, Math.min(1, smoothTime.value / props.phaseDuration)) * 100
})

// no active side → neutral white. NOT accent: the bar sits flush against the
// team-colored pick-card edges, so the neutral state stays separate from team state.
const color = computed(() =>
  props.activeSide === 'blue'
    ? 'var(--blue-team-color)'
    : props.activeSide === 'red'
      ? 'var(--red-team-color)'
      : 'rgb(255 255 255 / 0.75)',
)
</script>

<template>
  <div class="phase-timer-bar" :class="`side-${activeSide ?? 'none'}`">
    <div
      class="fill"
      :style="{ width: pct + '%', background: color, boxShadow: `0 0 12px ${color}` }"
    />
  </div>
</template>

<style scoped>
.phase-timer-bar {
  position: relative;
  width: 100%;
  height: 8px;
  background: rgb(0 0 0 / 0.85);
  overflow: hidden;
}

/* width is driven per-frame by the smooth countdown — no CSS transition */
.fill {
  position: absolute;
  top: 0;
  height: 100%;
}

/* blue active → anchored left; red active → anchored right */
.side-blue .fill,
.side-none .fill {
  left: 0;
}
.side-red .fill {
  right: 0;
}
</style>
