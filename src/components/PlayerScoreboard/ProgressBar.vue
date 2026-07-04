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
</script>

<template>
  <div
    :style="{
      'background-color': 'color-mix(in srgb, ' + fillColor + ' 50%, rgba(0, 0, 0, 0.5))',
      '--progress-pct': progressPct + '%',
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

<style lang="css" scoped></style>
