<script setup lang="ts">
import ObjectiveTimer from './ObjectiveTimer.vue'
import { useIngameSelector } from '@/composables/useIngame'

const baronTimer = useIngameSelector((state) => state.gameData.baronPitTimer)
const dragonTimer = useIngameSelector((state) => state.gameData.dragonPitTimer)
const gameTime = useIngameSelector((state) => state.gameData.gameTime)
</script>

<template>
  <div class="objective-timers">
    <ObjectiveTimer :objective-data="baronTimer" :game-time="gameTime" />
    <ObjectiveTimer :objective-data="dragonTimer" :game-time="gameTime" />
  </div>
</template>

<style scoped>
.objective-timers {
  display: flex;
  gap: 4px;
}
</style>
