<script setup lang="ts">
import { computed } from 'vue'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { buildGoldEfficiencyRows, hasGoldEfficiency } from './goldEfficiencyRows'

defineProps<{ sponsorLogo?: string; sponsorName?: string }>()

const client = useClient()
const data = useIngameSelector((state) => state.gameData.goldEfficiency)
const roster = useIngameSelector((state) => state.gameData.scoreboardBottom)
const scoreboard = useIngameSelector((state) => state.gameData.scoreboard)
const visible = computed(() => hasGoldEfficiency(data.value?.players))
const comparison = computed(() => buildGoldEfficiencyRows(data.value?.players, roster.value))
const teamNames = computed(() =>
  ['Blue team', 'Red team'].map(
    (fallback, side) =>
      scoreboard.value?.teams[side]?.teamName ||
      roster.value?.teams[side]?.name ||
      scoreboard.value?.teams[side]?.teamTag ||
      fallback,
  ),
)
</script>

<template>
  <Transition name="gold-efficiency">
    <section v-if="visible" class="efficiency-panel" aria-label="Gold efficiency comparison">
      <header class="panel-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>Gold efficiency</h2>
        <span class="definition">Champion damage / gold earned</span>
        <img
          v-if="sponsorLogo"
          :src="sponsorLogo"
          :alt="sponsorName || 'Sponsor'"
          class="sponsor-logo"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </header>

      <div class="comparison">
        <div class="team-headings">
          <span class="team-name blue" :title="teamNames[0]">{{ teamNames[0] }}</span>
          <span class="order-label">{{ comparison.paired ? 'Edge' : 'Rank' }}</span>
          <span class="team-name red" :title="teamNames[1]">{{ teamNames[1] }}</span>
        </div>

        <div
          v-for="row in comparison.rows"
          :key="row.label"
          class="matchup"
          :aria-label="comparison.paired ? row.label : 'Team rank ' + row.label"
        >
          <span
            v-if="comparison.paired"
            class="row-label edge"
            :class="row.edge"
            role="img"
            :aria-label="
              row.edge === 'left'
                ? 'Left player leads in gold efficiency'
                : row.edge === 'right'
                  ? 'Right player leads in gold efficiency'
                  : row.edge === 'even'
                    ? 'Even gold efficiency'
                    : 'Gold efficiency comparison unavailable'
            "
          >{{ row.edge === 'left' ? '◀' : row.edge === 'right' ? '▶' : row.edge === 'even' ? 'EVEN' : '—' }}</span>
          <span v-else class="row-label">{{ row.label }}</span>
          <div
            v-for="(player, side) in row.players"
            :key="side"
            class="player-side"
            :class="side === 0 ? 'blue' : 'red'"
          >
            <span class="champion-frame">
              <img
                v-if="player?.champion?.squareImg"
                :src="client.getCacheUrl(player.champion.squareImg)"
                alt=""
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </span>
            <span class="player-name" :title="playerDisplayName(player)">
              {{ playerDisplayName(player, '—') }}
            </span>
            <span class="bar-track" aria-hidden="true">
              <span
                class="bar-fill"
                :style="{ transform: 'scaleX(' + (player?.ratio ?? 0) / comparison.scale + ')' }"
              />
            </span>
            <span class="ratio">
              {{ player?.ratio == null ? '—' : player.ratio.toFixed(2) + '×' }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
/* Identical in both worktrees: inherit the skin's font and shared theme tokens.
   An opaque takeover keeps scoreboard items/notifications out of the chart. */
.efficiency-panel {
  height: 260px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: white;
  background:
    linear-gradient(
      115deg,
      color-mix(in oklab, var(--border-color) 15%, transparent),
      transparent 46%
    ),
    #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  flex-shrink: 0;
  padding: 0 16px;
  background:
    linear-gradient(
      115deg,
      color-mix(in oklab, var(--border-color) 24%, transparent),
      transparent 56%
    ),
    #1a1d24;
  border-bottom: var(--brand-border-width) solid var(--border-color);
}

.brand-marker {
  width: 5px;
  height: 22px;
  flex-shrink: 0;
  background: var(--border-color);
}

h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.definition {
  padding-left: 12px;
  border-left: 1px solid rgb(255 255 255 / 0.3);
  color: rgb(255 255 255 / 0.8);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}

.sponsor-logo {
  width: 28px;
  height: 28px;
  margin-left: auto;
  object-fit: contain;
}

.comparison {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 26px repeat(5, minmax(0, 1fr));
  padding: 0 16px 6px;
}

.team-headings,
.matchup {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
  align-items: center;
  min-height: 0;
}

.team-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 800;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.team-name.blue {
  color: var(--blue-team-color);
}
.team-name.red {
  color: var(--red-team-color);
  text-align: right;
}

.order-label,
.row-label {
  color: rgb(255 255 255 / 0.72);
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.order-label {
  font-size: 10px;
}
.row-label {
  grid-column: 2;
  grid-row: 1;
}
.edge {
  font-size: 20px;
  line-height: 1;
}
.edge.left {
  color: var(--blue-team-color);
}
.edge.right {
  color: var(--red-team-color);
}
.edge.even {
  color: white;
  font-size: 11px;
}
.matchup {
  border-top: 1px solid rgb(255 255 255 / 0.1);
}

.player-side {
  --team-color: var(--blue-team-color);
  display: grid;
  grid-template-columns: 30px 104px minmax(0, 1fr) 62px;
  align-items: center;
  column-gap: 8px;
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
}

.player-side.red {
  --team-color: var(--red-team-color);
  grid-column: 3;
  direction: rtl;
}

.champion-frame {
  width: 30px;
  height: 30px;
  border-inline-start: 3px solid var(--team-color);
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--surface-soft);
}

.champion-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-name {
  overflow: hidden;
  direction: ltr;
  text-align: left;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.red .player-name {
  text-align: right;
}

.bar-track {
  display: flex;
  justify-content: flex-end;
  height: 11px;
  direction: ltr;
  background: rgb(255 255 255 / 0.04);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.red .bar-track {
  justify-content: flex-start;
}

.bar-fill {
  width: 100%;
  height: 100%;
  background: var(--team-color);
  transform-origin: right;
  transition: transform 400ms ease-out;
}

.red .bar-fill {
  transform-origin: left;
}

.ratio {
  direction: ltr;
  text-align: center;
  font-size: 21px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.gold-efficiency-enter-active,
.gold-efficiency-leave-active {
  transition:
    transform 350ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 250ms ease;
}

.gold-efficiency-enter-from,
.gold-efficiency-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .bar-fill,
  .gold-efficiency-enter-active,
  .gold-efficiency-leave-active {
    transition: none;
  }
}
</style>
