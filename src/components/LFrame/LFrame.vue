<script setup lang="ts">
import { computed } from 'vue'
import { useIsInGame } from '@/composables/useIngame'
import GameInfo from './GameInfo.vue'
import SponsorRotation from './SponsorRotation.vue'
import ChampionDetailPanel from '../ChampionDetailPanel/ChampionDetailPanel.vue'
import InhibitorTimers from '../InhibitorTimers/InhibitorTimers.vue'
import FadeTransition from '../../transitions/FadeTransition.vue'
import { useIngameSelector } from '@/composables/useIngame'
import { useGameClock } from '@/composables/useGameClock'
import { useRoute } from 'vue-router'

const isInGame = useIsInGame()
const inhibitors = useIngameSelector((s) => s.gameData.inhibitors ?? [])
const gameTime = useGameClock()
const championDetail = useIngameSelector((s) => s.gameData.championDetail)
const route = useRoute()

const forceCutout = computed(
  () =>
    route.query.championinfo === 'cutout' ||
    new URLSearchParams(window.location.search).get('championinfo') === 'cutout',
)
const showChampionDetail = computed(() => !forceCutout.value && !!championDetail.value)

const showInhibitorTimers = computed(() =>
  inhibitors.value.some((team) =>
    Object.values(team.inhibitors ?? {}).some(
      (inhibitor) => (inhibitor.timeAlive ?? 0) > gameTime.value,
    ),
  ),
)
</script>

<template>
  <FadeTransition>
    <div v-if="isInGame" class="lframe-container">
      <div class="lframe-header">
        <GameInfo />
      </div>
      <div
        id="champion-info-cutout"
        :class="{ 'is-cutout': !showInhibitorTimers && !showChampionDetail }"
      >
        <InhibitorTimers v-if="showInhibitorTimers" class="inhibitor-detail" />
        <ChampionDetailPanel v-else-if="showChampionDetail" class="champion-detail" />
        <svg
          v-else
          class="cutout-frame"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 0 0 H 100 V 100 H 0 Z M 3 0 L 90 0 L 95 12 L 95 37 L 92 37 L 92 57 L 95 57 L 95 100 L 3 100 Z"
            fill="black"
            fill-rule="evenodd"
            clip-rule="evenodd"
          />
        </svg>
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
  /* Header/footer trimmed by 4px/10px vs. the previous 38/114 to hand the champion-detail
     panel more vertical room top and bottom. GameInfo and SponsorRotation drop their internal
     vertical padding by the same amounts so the patch bar and sponsor logos render unchanged. */
  grid-template-rows: 34px 1fr 104px;
  grid-template-columns: 1fr;
  z-index: 100;
}

.lframe-header {
  background-color: black;
}

.lframe-footer {
  background-color: black;
}

#champion-info-cutout {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background-color: black;
}

#champion-info-cutout.is-cutout {
  background-color: transparent;
}

.champion-detail,
.inhibitor-detail {
  position: absolute;
  inset: 0;
}

.cutout-frame {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
