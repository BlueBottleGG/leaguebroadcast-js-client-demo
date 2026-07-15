<script setup lang="ts">
import { computed } from 'vue'
import {
  damageBarSegments,
  formatDamage,
  sortDamageEntries,
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
  type postGameDamageGraph,
  type postGameDamageGraphEntry,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'

const props = defineProps<{
  damageGraph?: postGameDamageGraph
  blueSide: number
  redSide: number
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

const blueEntries = computed(() =>
  sortDamageEntries(props.damageGraph?.damageByTeam?.[props.blueSide]?.entries ?? []),
)
const redEntries = computed(() =>
  sortDamageEntries(props.damageGraph?.damageByTeam?.[props.redSide]?.entries ?? []),
)

const maxDamage = computed(() =>
  Math.max(...blueEntries.value.map((e) => e.damage), ...redEntries.value.map((e) => e.damage), 1),
)

function barWidth(entry: postGameDamageGraphEntry): string {
  const pct = (entry.damage / maxDamage.value) * 100
  return `max(${pct}%, 3%)`
}

function damageByTypeMap(entry: postGameDamageGraphEntry): { [k: string]: number } {
  return {
    physical: entry.physicalDamage,
    magic: entry.magicDamage,
    true: entry.trueDamage,
  }
}

function barFill(entry: postGameDamageGraphEntry, direction: 'right' | 'left'): string {
  const segments = damageBarSegments(damageByTypeMap(entry), entry.damage)
  if (!segments.length) {
    return direction === 'right' ? 'var(--blue-team-color)' : 'var(--red-team-color)'
  }
  const stops: string[] = []
  let acc = 0
  for (const seg of segments) {
    stops.push(`${seg.color} ${acc.toFixed(1)}%`)
    acc += seg.pct
    stops.push(`${seg.color} ${Math.min(acc, 100).toFixed(1)}%`)
  }
  return `linear-gradient(to ${direction}, ${stops.join(', ')})`
}

const LEGEND = [
  { label: 'Physical', color: PHYS_COLOR },
  { label: 'Magic', color: MAGIC_COLOR },
  { label: 'True', color: TRUE_COLOR },
]
</script>

<template>
  <div class="pg-damage">
    <div class="panel-header">
      <span class="panel-title">Damage Dealt to Champions</span>
      <div class="legend">
        <div v-for="item in LEGEND" :key="item.label" class="legend-item">
          <span class="legend-swatch" :style="{ background: item.color }" />
          <span class="legend-label">{{ item.label }}</span>
        </div>
      </div>
    </div>

    <div class="teams-row">
      <div class="team-column">
        <div v-for="entry in blueEntries" :key="entry.champion?.id" class="player-row">
          <img
            :src="cacheUrl(entry.champion?.squareImg)"
            class="player-icon"
            @error="handleImageError"
            @load="handleImageLoad"
          />
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: barWidth(entry), background: barFill(entry, 'right') }"
            />
          </div>
          <span class="damage-value">{{ formatDamage(entry.damage) }}</span>
        </div>
      </div>

      <div class="team-column mirrored">
        <div v-for="entry in redEntries" :key="entry.champion?.id" class="player-row">
          <img
            :src="cacheUrl(entry.champion?.squareImg)"
            class="player-icon"
            @error="handleImageError"
            @load="handleImageLoad"
          />
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: barWidth(entry), background: barFill(entry, 'left') }"
            />
          </div>
          <span class="damage-value">{{ formatDamage(entry.damage) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg-damage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 26px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 17px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: white;
}

.legend {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-swatch {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-xs);
}

.legend-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.65);
}

.teams-row {
  display: flex;
  gap: 20px;
}

.team-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-column.mirrored .player-row {
  flex-direction: row-reverse;
}

.player-icon {
  width: 38px;
  height: 38px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 20px;
  display: flex;
  border-radius: var(--radius-xs);
  background: rgb(255 255 255 / 0.06);
  overflow: hidden;
}

.team-column.mirrored .bar-track {
  justify-content: flex-end;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-xs);
}

.damage-value {
  width: 54px;
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
}

.team-column.mirrored .damage-value {
  text-align: right;
}
</style>
