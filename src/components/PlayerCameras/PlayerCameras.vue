<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import { getCameraTestConfig } from '@/composables/usePlayerCameraRoster'
import { Team } from '@bluebottle_gg/league-broadcast-client'
import PlayerCamera from './PlayerCamera.vue'

const scoreboard = useIngameSelector((s) => s.gameData.scoreboardBottom)
const teamfight = useIngameSelector((s) => s.gameData.teamfightDamageOverview)
// ?camtest=<prefix> forces the cameras visible so they can be tested without live game data.
const forceShow = getCameraTestConfig() !== null
</script>

<template>
  <Transition name="slide-down">
    <div v-show="scoreboard || teamfight || forceShow" class="camera-container">
      <PlayerCamera
        show
        :team="Team.Order"
        :scoreboard="scoreboard"
        :teamfight="teamfight"
        class="border rounded-t-sm border-r-0.5 border-b-0 camera-border"
      />
      <div></div>
      <PlayerCamera
        show
        :team="Team.Chaos"
        :scoreboard="scoreboard"
        :teamfight="teamfight"
        class="border rounded-t-sm border-r-0.5 border-b-0 camera-border"
      />
    </div>
  </Transition>
</template>

<style lang="css" scoped>
.camera-border {
  border-color: var(--border-color);
  border-width: var(--brand-border-width);
  border-bottom-width: 0;
}

.camera-container {
  display: grid;
  grid-template-columns: 178px 1fr 178px;
  grid-template-rows: 1fr;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.5s ease;
}

/* Slide in from the bottom edge rather than dropping in from the top. */
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(100%);
}
</style>
