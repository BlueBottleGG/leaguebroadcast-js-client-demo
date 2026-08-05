<script setup lang="ts">
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { getRemaining } from '@bluebottle_gg/league-broadcast-client'
import { useGameClock } from '@/composables/useGameClock'
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
    /** Toggle-able spell currently switched on — draws the sweeping white rim. */
    isToggled?: boolean
  }>(),
  {
    img: '',
    readyAt: 0,
    totalCooldown: 0,
    showTimer: true,
    skilled: false,
    dimUnskilled: false,
    isToggled: false,
  },
)

const gameTime = useGameClock()

const remaining = computed(() => getRemaining(props.readyAt, gameTime.value))

// Everything the template reads is quantized to what is actually visible — whole degrees of
// sweep (sub-pixel at icon size) and whole seconds — so a slot only re-renders when it
// changes on screen rather than on every animation frame.
const onCooldown = computed(() => remaining.value > 0)
const secondsLeft = computed(() => Math.ceil(remaining.value))

const elapsedDegrees = computed(() => {
  if (!props.readyAt || !props.totalCooldown) {
    return 0
  }
  const elapsed = 1 - remaining.value / props.totalCooldown
  return Math.round(360 * Math.min(1, Math.max(0, elapsed)))
})
</script>

<template>
  <div class="relative overflow-hidden">
    <div
      v-if="onCooldown"
      class="absolute h-full w-full timer-fill"
      :style="{ '--cooldown-fill': elapsedDegrees + `deg` }"
    ></div>
    <FadeTransition>
      <p class="cooldown-text" v-if="showTimer && secondsLeft > 0 && secondsLeft <= 10">
        {{ secondsLeft }}
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
    <span v-if="isToggled" class="toggle-glow" aria-hidden="true"></span>
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

/* Toggled-on rim: the same swirl the scoreboard uses for baron+elder, in white and pulled
   inside the icon so it reads as the spell itself being lit rather than a border around it. */
.toggle-glow {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.55);
}

.toggle-glow::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: conic-gradient(
    from var(--spell-toggle-angle),
    transparent 0deg 70deg,
    rgba(255, 255, 255, 0.85) 115deg,
    #fff 145deg,
    rgba(255, 255, 255, 0.85) 175deg,
    transparent 220deg 360deg
  );
  mask:
    linear-gradient(
      to bottom,
      #000 2px,
      transparent 0,
      transparent calc(100% - 2px),
      #000 calc(100% - 2px)
    ),
    linear-gradient(
      to right,
      #000 2px,
      transparent 0,
      transparent calc(100% - 2px),
      #000 calc(100% - 2px)
    );
  mask-composite: add;
  -webkit-mask:
    linear-gradient(
      to bottom,
      #000 2px,
      transparent 0,
      transparent calc(100% - 2px),
      #000 calc(100% - 2px)
    ),
    linear-gradient(
      to right,
      #000 2px,
      transparent 0,
      transparent calc(100% - 2px),
      #000 calc(100% - 2px)
    );
  -webkit-mask-composite: source-over;
  animation: spell-toggle-swirl 2.4s linear infinite;
}

@property --spell-toggle-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes spell-toggle-swirl {
  to {
    --spell-toggle-angle: 360deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toggle-glow::before {
    animation: none;
  }
}
</style>
