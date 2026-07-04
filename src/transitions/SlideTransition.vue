<template>
  <Transition :name="transitionName" :style="cssVars" v-bind="$attrs">
    <slot />
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Direction = 'up' | 'down' | 'left' | 'right'

const props = withDefaults(
  defineProps<{
    enterFrom?: Direction
    leaveTo?: Direction
    duration?: number
    fade?: boolean
  }>(),
  {
    enterFrom: 'down',
    leaveTo: 'down',
    duration: 300,
    fade: false,
  },
)

function directionToTranslate(dir: Direction): string {
  switch (dir) {
    case 'up':
      return '0, -100%'
    case 'down':
      return '0, 100%'
    case 'left':
      return '-100%, 0'
    case 'right':
      return '100%, 0'
  }
}

const transitionName = computed(
  () => `slide-${props.enterFrom}-${props.leaveTo}${props.fade ? '-fade' : ''}`,
)

const cssVars = computed(() => ({
  '--slide-duration': `${props.duration}ms`,
  '--slide-enter-translate': directionToTranslate(props.enterFrom),
  '--slide-leave-translate': directionToTranslate(props.leaveTo),
}))
</script>

<style>
/* Shared active states — duration & easing */
[class*='slide-'][class*='-enter-active'],
[class*='slide-'][class*='-leave-active'] {
  transition:
    transform var(--slide-duration, 300ms) ease,
    opacity var(--slide-duration, 300ms) ease;
}

/* Enter: start off-screen */
[class*='slide-'][class*='-enter-from'] {
  transform: translate(var(--slide-enter-translate, 0, -100%));
}

/* Leave: exit off-screen */
[class*='slide-'][class*='-leave-to'] {
  transform: translate(var(--slide-leave-translate, 0, 100%));
}

/* Fade variant — opacity on top of the slide */
[class*='slide-'][class*='-fade-enter-from'],
[class*='slide-'][class*='-fade-leave-to'] {
  opacity: 0;
}
</style>
