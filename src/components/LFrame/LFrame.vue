<script setup lang="ts">
import { useIsInGame } from '@/composables/useIngame'
import GameInfo from './GameInfo.vue'
import SponsorRotation from './SponsorRotation.vue'
import ChampionDetailPanel from '../ChampionDetailPanel/ChampionDetailPanel.vue'
import FadeTransition from '../../transitions/FadeTransition.vue'

const isInGame = useIsInGame()
</script>

<template>
  <FadeTransition>
    <div v-if="isInGame" class="lframe-container">
      <div class="lframe-header">
        <GameInfo />
      </div>
      <div class="lframe-champion-info">
        <ChampionDetailPanel />
      </div>
      <div class="lframe-footer">
        <SponsorRotation />
      </div>
    </div>
  </FadeTransition>
</template>

<style lang="css" scoped>
.lframe-container {
  display: grid;
  grid-template-rows: 34px 1fr 102px;
  grid-template-columns: 1fr;
  z-index: 100;
}

.lframe-header,
.lframe-footer,
.lframe-champion-info {
  background-color: black;
}

.lframe-champion-info {
  position: relative;
  min-height: 0;
  overflow: hidden;
}
</style>
