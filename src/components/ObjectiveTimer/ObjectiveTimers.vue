<script setup lang="ts">
import ObjectiveTimer from './ObjectiveTimer.vue'
import { useIngameSelector } from '@/composables/useIngame'

const baronTimer = useIngameSelector((state) => state.gameData.baronPitTimer)
const dragonTimer = useIngameSelector((state) => state.gameData.dragonPitTimer)
</script>

<template>
  <div class="objective-timers">
    <ObjectiveTimer :objective-data="baronTimer" />
    <ObjectiveTimer :objective-data="dragonTimer" />
  </div>
</template>

<style scoped>
.objective-timers {
  display: flex;
  gap: 4px;
}
</style>
