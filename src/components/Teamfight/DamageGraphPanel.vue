<script setup lang="ts">
import { computed } from 'vue'
import { useClient } from '@/client'
import {
  Team,
  damageBarSegments,
  formatDamage,
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
  type simpleChampionData,
} from '@bluebottle_gg/league-broadcast-client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import brandEmblem from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'

export interface DamageGraphPanelEntry {
  key: string
  champion?: simpleChampionData
  displayName: string
  team?: number
  totalDamage: number
  damageByType?: { [key: string]: number }
}

const props = withDefaults(
  defineProps<{
    title: string
    entries: DamageGraphPanelEntry[]
    /** Changes when a new backend payload should replay the row animations. */
    renderKey?: string
  }>(),
  { renderKey: '' },
)

const client = useClient()

const blueEntries = computed(() =>
  props.entries
    .filter((entry) => entry.team === Team.Order)
    .sort((a, b) => b.totalDamage - a.totalDamage),
)
const redEntries = computed(() =>
  props.entries
    .filter((entry) => entry.team === Team.Chaos)
    .sort((a, b) => b.totalDamage - a.totalDamage),
)

const visibleEntryCount = computed(() => blueEntries.value.length + redEntries.value.length)
const maxDamage = computed(() =>
  Math.max(...props.entries.map((entry) => Math.max(entry.totalDamage, 0)), 1),
)
const showsDamageTypes = computed(() =>
  props.entries.some(
    (entry) => damageBarSegments(entry.damageByType ?? {}, entry.totalDamage).length > 0,
  ),
)

function barWidth(entry: DamageGraphPanelEntry): string {
  const pct = (Math.max(entry.totalDamage, 0) / maxDamage.value) * 100
  return `max(${pct}%, 3%)`
}

/**
 * Split the fill by damage type when the backend provides that breakdown.
 * Payloads without composition data fall back to a neutral fill while keeping
 * the same layout and scale; team colors never imply damage type.
 */
function barFill(entry: DamageGraphPanelEntry, direction: 'right' | 'left'): string {
  const segments = damageBarSegments(entry.damageByType ?? {}, entry.totalDamage)
  if (!segments.length) {
    return 'rgba(255, 255, 255, 0.28)'
  }

  const stops: string[] = []
  let acc = 0
  for (const segment of segments) {
    stops.push(`${segment.color} ${acc.toFixed(1)}%`)
    acc += segment.pct
    stops.push(`${segment.color} ${Math.min(acc, 100).toFixed(1)}%`)
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
  <Transition name="damage-slide">
    <div
      v-if="visibleEntryCount"
      class="damage-container"
      role="img"
      :aria-label="`${title} graph`"
    >
      <div class="damage-header">
        <div class="header-left">
          <img :src="brandEmblem" class="header-emblem" alt="" />
          <span class="header-title">{{ title }}</span>
        </div>
        <div v-if="showsDamageTypes" class="header-legend" aria-label="Damage types">
          <div v-for="item in LEGEND" :key="item.label" class="legend-item">
            <span class="legend-swatch" :style="{ background: item.color }" />
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
      </div>

      <div class="teams-row">
        <div class="team-column">
          <div
            v-for="(entry, i) in blueEntries"
            :key="`${renderKey}:${entry.key}`"
            class="player-row"
            :style="{ '--bar-i': i }"
          >
            <img
              :src="client.getCacheUrl(entry.champion?.squareImg)"
              class="player-icon"
              alt=""
              @error="handleImageError"
              @load="handleImageLoad"
            />
            <span class="player-name" :title="entry.displayName">{{ entry.displayName }}</span>
            <div class="bar-track">
              <div
                class="bar-fill grow-right"
                :style="{ width: barWidth(entry), background: barFill(entry, 'right') }"
              />
            </div>
            <span class="damage-value">{{ formatDamage(entry.totalDamage) }}</span>
          </div>
        </div>

        <div class="team-column mirrored">
          <div
            v-for="(entry, i) in redEntries"
            :key="`${renderKey}:${entry.key}`"
            class="player-row"
            :style="{ '--bar-i': i }"
          >
            <img
              :src="client.getCacheUrl(entry.champion?.squareImg)"
              class="player-icon"
              alt=""
              @error="handleImageError"
              @load="handleImageLoad"
            />
            <span class="player-name" :title="entry.displayName">{{ entry.displayName }}</span>
            <div class="bar-track">
              <div
                class="bar-fill grow-left"
                :style="{ width: barWidth(entry), background: barFill(entry, 'left') }"
              />
            </div>
            <span class="damage-value">{{ formatDamage(entry.totalDamage) }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
.damage-container {
  width: 100%;
  height: 260px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
  background:
    linear-gradient(
      to bottom,
      color-mix(in oklab, var(--broadcast-accent) 12%, transparent),
      transparent 160px
    ),
    #0d0a0c;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 -2px 32px rgba(0, 0, 0, 0.6);
}

/* Solid accent bar with white type — the project CI header treatment. */
.damage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 8px 18px;
  background: var(--broadcast-accent);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-emblem {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.header-title {
  font-size: 15px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: white;
}

.header-legend {
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
  width: 10px;
  height: 10px;
  border-radius: var(--radius-xs);
}

.legend-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.8);
}

.teams-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 18px 14px;
}

.team-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.team-column.mirrored .player-row {
  flex-direction: row-reverse;
}

.player-icon {
  width: 24px;
  height: 24px;
  object-fit: cover;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}

.player-name {
  width: 88px;
  flex-shrink: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: rgba(255, 255, 255, 0.9);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-column.mirrored .player-name {
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 14px;
  display: flex;
  border-radius: var(--radius-xs);
  background: rgba(255, 255, 255, 0.06);
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
  width: 44px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.team-column.mirrored .damage-value {
  text-align: right;
}

.grow-right {
  animation: bar-grow-right 0.5s cubic-bezier(0.25, 1, 0.5, 1) both;
  animation-delay: calc(var(--bar-i, 0) * 80ms + 400ms);
}

.grow-left {
  animation: bar-grow-left 0.5s cubic-bezier(0.25, 1, 0.5, 1) both;
  animation-delay: calc(var(--bar-i, 0) * 80ms + 400ms);
}

@keyframes bar-grow-right {
  from {
    clip-path: inset(0 100% 0 0);
  }

  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes bar-grow-left {
  from {
    clip-path: inset(0 0 0 100%);
  }

  to {
    clip-path: inset(0 0 0 0);
  }
}

.damage-slide-enter-active,
.damage-slide-leave-active {
  transition:
    opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.damage-slide-enter-from,
.damage-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@media (prefers-reduced-motion: reduce) {
  .grow-right,
  .grow-left {
    animation: none;
  }

  .damage-slide-enter-active,
  .damage-slide-leave-active {
    transition: none;
  }
}
</style>
