<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useClient } from '@/client'
import { useIsInGame } from '@/composables/useIngame'
import type { announcerEvent } from '@bluebottle_gg/league-broadcast-client'
import { useAnnouncerQueue } from './useAnnouncerQueue'
import AnnouncerBanner from './AnnouncerBanner.vue'

const client = useClient()
const isInGame = useIsInGame()
const route = useRoute()
const showGrompKill = computed(() => Object.hasOwn(route.query, 'gromp'))

const { current, enqueue, resetGame } = useAnnouncerQueue()

const unsub = client.onIngameEvents({
  onAnnouncementEvent(event: announcerEvent) {
    if (String(event.type) === 'GrompKill' && !showGrompKill.value) return
    enqueue(event)
  },
})

const stopGameWatch = watch(isInGame, (inGame, wasInGame) => {
  if (!inGame && wasInGame) resetGame()
})

onUnmounted(() => {
  stopGameWatch()
  unsub()
})
</script>

<template>
  <div v-if="isInGame" class="announcer">
    <Transition name="announcer" mode="out-in">
      <AnnouncerBanner v-if="current" :key="current.id" :announcement="current" />
    </Transition>
  </div>
</template>

<style lang="css" scoped>
.announcer {
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.announcer-enter-active {
  animation: announcer-reveal 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: opacity, transform;
}

.announcer-leave-active {
  animation: announcer-dismiss 380ms cubic-bezier(0.7, 0, 0.84, 0) both;
  will-change: opacity, transform;
}

@keyframes announcer-reveal {
  from {
    opacity: 0;
    transform: translateY(-12px) scaleX(0.86);
  }
  70% {
    opacity: 1;
    transform: translateY(0) scaleX(1.012);
  }
  to {
    opacity: 1;
    transform: translateY(0) scaleX(1);
  }
}

@keyframes announcer-dismiss {
  from {
    opacity: 1;
    transform: translateY(0) scaleX(1);
  }
  28% {
    opacity: 1;
    transform: translateY(-2px) scaleX(1.012);
  }
  to {
    opacity: 0;
    transform: translateY(-9px) scaleX(0.88);
  }
}

@media (prefers-reduced-motion: reduce) {
  .announcer-enter-active,
  .announcer-leave-active {
    animation: none;
    transition: opacity 120ms linear;
  }

  .announcer-enter-from,
  .announcer-leave-to {
    opacity: 0;
  }
}
</style>
