<script setup lang="ts">
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { getRemaining } from '@bluebottle_gg/league-broadcast-client'
import { useIngameSelector } from '@/composables/useIngame'
import { computed } from 'vue'
import FadeTransition from '../../transitions/FadeTransition.vue'

const props = withDefaults(
  defineProps<{
    img?: string
    readyAt?: number
    totalCooldown?: number
    showTimer?: boolean
    skilled?: boolean
    /** When true, render the icon grayed out (instead of hidden) while unskilled. */
    dimUnskilled?: boolean
  }>(),
  {
    img: '',
    readyAt: 0,
    totalCooldown: 0,
    showTimer: true,
    skilled: false,
    dimUnskilled: false,
  },
)

const gameTime = useIngameSelector((s) => s.gameData.gameTime)

const remaining = computed(() => getRemaining(props.readyAt, gameTime.value))

const cooldownPercent = computed(() => {
  if (!props.readyAt || !props.totalCooldown) {
    return 0
  }
  return Math.min(100, Math.max(0, (1 - remaining.value / props.totalCooldown) * 100))
})
</script>

<template>
  <div class="relative overflow-hidden">
    <div
      v-if="remaining > 0"
      class="absolute h-full w-full timer-fill"
      :style="{ '--cooldown-fill': cooldownPercent * 3.6 + `deg` }"
    ></div>
    <FadeTransition>
      <p class="cooldown-text" v-if="showTimer && remaining > 0 && remaining <= 10">
        {{ Math.ceil(remaining) }}
      </p>
    </FadeTransition>
    <img
      v-if="skilled || dimUnskilled"
      class="h-full w-full object-cover block"
      :class="{ 'unskilled-dim': !skilled }"
      :src="img"
      @error="handleImageError"
      @load="handleImageLoad"
    />
  </div>
</template>

<style lang="css" scoped>
.unskilled-dim {
  filter: grayscale(1) brightness(0.45);
  opacity: 0.6;
}

.timer-fill {
  background: conic-gradient(
    transparent 0deg var(--cooldown-fill),
    rgba(0, 0, 0, 0.7) var(--cooldown-fill) 360deg
  );
  transition: --cooldown-fill 1s linear;
}

.cooldown-text {
  position: absolute;
  inset: 0;
  margin: 0;
  text-align: center;
  color: white;
  font-weight: 800;
  font-size: var(--cooldown-font-size, 1em);
  line-height: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;

  transform: translateY(-2px);
}

@property --cooldown-fill {
  syntax: '<angle>';
  /* its type */
  inherits: false;
  initial-value: 0deg;
  /* the initial value */
}
</style>
