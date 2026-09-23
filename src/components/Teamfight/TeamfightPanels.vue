<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import TeamfightRecap from './TeamfightRecap.vue'
import TeamfightDamageDealt from './TeamfightDamageDealt.vue'

const hasTimeline = useIngameSelector((state) => !!state.gameData.teamfightTimeline?.players?.length)
</script>

<template>
  <div class="teamfight-panels">
    <TeamfightRecap v-if="hasTimeline" />
    <TeamfightDamageDealt v-else />
  </div>
</template>

<style scoped>
.teamfight-panels {
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
</style>
