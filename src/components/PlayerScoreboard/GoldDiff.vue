<script setup lang="ts">
import { computed } from 'vue'
import FadeTransition from '../../transitions/FadeTransition.vue'

const props = defineProps<{
  orderGold: number
  chaosGold: number
}>()

const diff = computed(() => props.orderGold - props.chaosGold)

const formattedDiff = computed(() => {
  const d = Math.abs(diff.value)
  if (d >= 1000) return (d / 1000).toFixed(1) + 'K'
  return Math.floor(d).toString()
})

const leadingTeam = computed(() => {
  if (diff.value > 0) return 'order'
  if (diff.value < 0) return 'chaos'
  return null
})
</script>

<template>
  <div class="gold-diff">
    <!-- Order (blue) indicator: bracket pointing left -->
    <FadeTransition>
      <svg
        v-if="leadingTeam === 'order'"
        class="indicator indicator-order"
        viewBox="-0.5 -0.5 10 30.5"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <polygon
          points="8,0 4,0 4,10 0,15 4,20 4,30 8,30, 8,0"
          fill="var(--blue-team-color)"
          stroke="rgba(0,0,0,1)"
          stroke-width="1"
          stroke-linejoin="miter"
        />
      </svg>
    </FadeTransition>

    <span class="gold-value">{{ formattedDiff }}</span>
    <!-- Chaos (red) indicator: bracket pointing right -->
    <FadeTransition>
      <svg
        v-if="leadingTeam === 'chaos'"
        class="indicator indicator-chaos"
        viewBox="-0.5 -0.5 10 30.5"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,0 4,0 4,10 8,15 4,20 4,30 0,30 0,0"
          fill="var(--red-team-color)"
          stroke="rgba(0,0,0,1)"
          stroke-width="1"
          stroke-linejoin="miter"
        />
      </svg>
    </FadeTransition>
  </div>
</template>

<style lang="css" scoped>
.gold-diff {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: var(--brand-border-width) solid var(--border-color);
  border-right: var(--brand-border-width) solid var(--border-color);
  overflow: visible;
  /* Add subtle drop shadow for better visibility */
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
}

.gold-value {
  font-weight: 800;
  font-size: 20px;
  line-height: 20px;
  color: white;
  z-index: 1;
}

.indicator {
  position: absolute;
  width: 10px;
  height: 48px;
  z-index: 2;
}

.indicator-order {
  left: -3px;
}

.indicator-chaos {
  right: -3px;
}
</style>
