<script setup lang="ts">
import { computed } from 'vue'
import { getPostGameSides, type postGameOverview } from '@bluebottle_gg/league-broadcast-client'
import PostGameHeader from './PostGameHeader.vue'
import PostGameSummary from './PostGameSummary.vue'
import PostGameDamageChart from './PostGameDamageChart.vue'
import PostGameGoldGraph from './PostGameGoldGraph.vue'
import PostGameBrandBar from './PostGameBrandBar.vue'

/**
 * Overview screen — the original single-screen post-game layout, moved verbatim
 * out of PostGameScene.vue so the scene can act purely as a screen shell. Header
 * + summary + damage chart + gold graph, unchanged.
 */
const props = defineProps<{
  overview?: postGameOverview | null
}>()

const sides = computed(() => (props.overview ? getPostGameSides(props.overview) : []))
const blueSide = computed(() => Math.min(...(sides.value.length ? sides.value : [100])))
const redSide = computed(() => Math.max(...(sides.value.length ? sides.value : [200])))

const blueOverview = computed(() => props.overview?.teamOverviewBySide?.[blueSide.value])
const redOverview = computed(() => props.overview?.teamOverviewBySide?.[redSide.value])
</script>

<template>
  <div v-if="overview" class="content-column">
    <PostGameHeader :overview="overview" :blue-side="blueSide" :red-side="redSide" />

    <div class="body-grid">
      <div class="col-left">
        <PostGameSummary
          v-if="blueOverview && redOverview"
          :blue="blueOverview"
          :red="redOverview"
        />
      </div>
      <div class="col-right">
        <PostGameDamageChart
          :damage-graph="overview.damageGraph"
          :blue-side="blueSide"
          :red-side="redSide"
        />
        <PostGameGoldGraph
          :gold-graph="overview.goldGraph"
          :blue-side="blueSide"
          :red-side="redSide"
        />
        <div class="brand-cell">
          <PostGameBrandBar />
        </div>
      </div>
    </div>
  </div>

  <div v-else class="pg-empty"><span>No Data</span></div>
</template>

<style scoped>
.content-column {
  position: relative;
  width: 1560px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.body-grid {
  display: grid;
  grid-template-columns: 46% 1fr;
  gap: 14px;
  align-items: stretch;
}

.col-left,
.col-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* Left summary stretches to match the right column's full height (through the
   sponsor plate) so both columns bottom-align. */
.col-left > :deep(.pg-summary) {
  flex: 1;
}

/* Bottom-right "powered by" logo lockup, sitting on its own panel to echo the
   reference layout's corner plate. */
.brand-cell {
  margin-top: auto;
  display: flex;
  justify-content: center;
  padding: 14px 26px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

/* ── Empty ── */
.pg-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.pg-empty span {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.4);
}
</style>
