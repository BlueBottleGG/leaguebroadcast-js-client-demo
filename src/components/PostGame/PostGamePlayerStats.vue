<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStats } from '@/composables/usePostGameScreens'
import { playerDisplayName } from '@/utils/playerDisplayName'
import PostGamePlayerIdentity from './PostGamePlayerIdentity.vue'
import PostGameScreenFrame from './PostGameScreenFrame.vue'

/**
 * Player performance screen: same champion identity block (left) + a single
 * "Performance" panel of up to six big stat rows (right).
 */
const props = defineProps<{
  playerIndex: number
  gameId?: number
}>()

const playerIndexRef = computed(() => props.playerIndex)
const gameIdRef = computed(() => props.gameId)
const data = usePlayerStats(playerIndexRef, gameIdRef)

const side = computed<'blue' | 'red'>(() => (props.playerIndex < 5 ? 'blue' : 'red'))

const rows = computed(() => (data.value?.infoRows ?? []).slice(0, 6))
const label = (key: string) => key.replace(/_/g, ' ')
</script>

<template>
  <PostGameScreenFrame v-if="data" title="Player Performance" subtitle="Match stats">
    <div class="pg-player-stats">
      <div class="left">
        <PostGamePlayerIdentity
          :champion="data.champion"
          :display-name="
            playerDisplayName({ displayName: data.displayName, name: data.nameWithTag })
          "
          :team-tag="data.team?.tag"
          :side="side"
        />
      </div>

      <div class="right">
        <section class="panel">
          <h2 class="panel-title">Performance</h2>
          <div class="stat-rows">
            <div v-for="(row, i) in rows" :key="`row-${i}`" class="stat-row">
              <span class="stat-key">{{ label(row.key) }}</span>
              <span class="stat-value">{{ row.value }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </PostGameScreenFrame>

  <div v-else class="pg-empty">
    <span>No Data</span>
  </div>
</template>

<style scoped>
.pg-player-stats {
  height: 100%;
  display: grid;
  grid-template-columns: 46% 1fr;
  gap: 40px;
}

.left {
  position: relative;
  min-width: 0;
}

.right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.panel {
  padding: 28px 32px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.panel-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: white;
}

.stat-rows {
  display: flex;
  flex-direction: column;
}

.stat-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 0;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
}
.stat-row:last-child {
  border-bottom: none;
}

.stat-key {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.55);
}

.stat-value {
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  color: white;
  font-variant-numeric: tabular-nums;
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
