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
import { LANE_LABELS } from '@/utils/laneOrder'
import broadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import TopIcon from '@/assets/lane/top-placeholder-cropped.svg'
import JungleIcon from '@/assets/lane/jgl-placeholder-cropped.svg'
import MidIcon from '@/assets/lane/mid-placeholder-cropped.svg'
import BotIcon from '@/assets/lane/bot-placeholder-cropped.svg'
import SupportIcon from '@/assets/lane/sup-placeholder-cropped.svg'

const LANE_ICONS = [TopIcon, JungleIcon, MidIcon, BotIcon, SupportIcon]

export interface DamageGraphPanelEntry {
  key: string
  champion?: simpleChampionData
  displayName: string
  team?: number
  /** 0 = top … 4 = support. Undefined when the payload carries no lane info. */
  laneIndex?: number
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

/**
 * Rows read top → support like the scoreboard rather than biggest-bar-first:
 * a viewer scanning the panel finds a player by lane, and the two columns line
 * up as lane matchups. Payloads that don't tag lanes keep the order the backend
 * sent (which is already hero-index order), so nothing is reshuffled on a guess.
 */
function inLaneOrder(entries: DamageGraphPanelEntry[]): DamageGraphPanelEntry[] {
  if (entries.some((entry) => entry.laneIndex === undefined)) return entries
  return [...entries].sort((a, b) => a.laneIndex! - b.laneIndex!)
}

function toRows(entries: DamageGraphPanelEntry[]) {
  return inLaneOrder(entries).map((entry) => ({
    ...entry,
    laneIcon: entry.laneIndex === undefined ? undefined : LANE_ICONS[entry.laneIndex],
    laneLabel: entry.laneIndex === undefined ? '' : (LANE_LABELS[entry.laneIndex] ?? ''),
  }))
}

const columns = computed(() => [
  {
    side: 'order',
    mirrored: false,
    direction: 'right' as const,
    rows: toRows(props.entries.filter((entry) => entry.team === Team.Order)),
  },
  {
    side: 'chaos',
    mirrored: true,
    direction: 'left' as const,
    rows: toRows(props.entries.filter((entry) => entry.team === Team.Chaos)),
  },
])

const visibleEntryCount = computed(() =>
  columns.value.reduce((sum, column) => sum + column.rows.length, 0),
)
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
  <Transition name="damage-panel">
    <div v-if="visibleEntryCount" class="damage-panel" role="img" :aria-label="`${title} graph`">
      <header class="panel-header">
        <span class="brand-marker" />
        <h2>{{ title }}</h2>
        <div v-if="showsDamageTypes" class="header-legend" aria-label="Damage types">
          <div v-for="item in LEGEND" :key="item.label" class="legend-item">
            <span class="legend-swatch" :style="{ background: item.color }" />
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
        <span class="header-divider" />
        <img :src="broadcastLogo" alt="League Broadcast" class="header-logo" />
      </header>

      <div class="teams-row">
        <div
          v-for="column in columns"
          :key="column.side"
          class="team-column"
          :class="[column.side, { mirrored: column.mirrored }]"
          :style="{ '--row-count': column.rows.length }"
        >
          <div
            v-for="(entry, i) in column.rows"
            :key="`${renderKey}:${entry.key}`"
            class="player-row"
            :style="{ '--row-i': i }"
          >
            <img
              :src="client.getCacheUrl(entry.champion?.squareImg)"
              class="player-icon"
              alt=""
              @error="handleImageError"
              @load="handleImageLoad"
            />
            <component
              :is="entry.laneIcon"
              v-if="entry.laneIcon"
              class="lane-icon"
              role="img"
              :aria-label="entry.laneLabel"
            />
            <span class="player-name" :title="entry.displayName">{{ entry.displayName }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :class="`grow-${column.direction}`"
                :style="{ width: barWidth(entry), background: barFill(entry, column.direction) }"
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
/* Bottom-flush broadcast card: same surface, border, accent wash and sheen as
   the side info panel and gold graph title bar, squared off on the screen edge
   per the radius scale in style.css. */
.damage-panel {
  width: 100%;
  height: 260px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
  /* Match the production display font. */
  font-family: 'Bebas Neue';
  font-variant-numeric: tabular-nums;
  color: white;
  background:
    linear-gradient(
      115deg,
      color-mix(in oklab, var(--broadcast-accent) 13%, transparent),
      transparent 46%
    ),
    linear-gradient(180deg, rgb(255 255 255 / 0.05), transparent 26%), rgb(4 5 8 / 0.94);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 0 18px color-mix(in oklab, var(--broadcast-accent) 32%, transparent);
}

.panel-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  flex-shrink: 0;
  padding: 0 18px;
  overflow: hidden;
  background:
    linear-gradient(
      115deg,
      color-mix(in oklab, var(--broadcast-accent) 26%, transparent),
      transparent 56%
    ),
    #1a1d24;
  border-bottom: 2px solid var(--border-color);
}

/* Brand sheen: the same slow accent sweep the other panels run */
.panel-header::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  width: 42%;
  background: linear-gradient(
    100deg,
    transparent,
    color-mix(in oklab, var(--broadcast-accent) 20%, transparent 55%),
    transparent
  );
  animation: damage-header-sheen 16s ease-in-out infinite;
  pointer-events: none;
}

@keyframes damage-header-sheen {
  0% {
    transform: translateX(-125%) skewX(-18deg);
  }

  22% {
    transform: translateX(340%) skewX(-18deg);
  }

  100% {
    transform: translateX(340%) skewX(-18deg);
  }
}

.brand-marker {
  width: 5px;
  height: 22px;
  flex-shrink: 0;
  background: var(--broadcast-accent);
  box-shadow: 0 0 10px color-mix(in oklab, var(--broadcast-accent) 65%, transparent);
}

h2 {
  margin: 0;
  color: white;
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.header-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-xs);
}

.legend-label {
  color: rgb(255 255 255 / 0.8);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.header-divider {
  width: 1px;
  height: 20px;
  margin-left: auto;
  background: rgb(255 255 255 / 0.18);
}

/* With a legend present the legend already claims the free space; the divider
   then only needs to sit next to the logo. */
.header-legend + .header-divider {
  margin-left: 0;
}

.header-logo {
  width: 84px;
  max-height: 24px;
  object-fit: contain;
}

.teams-row {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 12px 18px 16px;
}

/* Team identity is the vertical rail on each column's outer edge, mirroring the
   gradient team borders on the compact teamfight card. */
.team-column {
  --team-color: var(--blue-team-color);
  --team-color-soft: color-mix(in oklab, var(--team-color) 42%, transparent);
  --team-color-track: color-mix(in oklab, var(--team-color) 22%, transparent);
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
}

.team-column.mirrored {
  --team-color: var(--red-team-color);
  padding-left: 0;
  padding-right: 12px;
}

.team-column::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--team-color) 45%, transparent);
}

.team-column.mirrored::before {
  left: auto;
  right: 0;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.team-column.mirrored .player-row {
  flex-direction: row-reverse;
}

.player-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  object-fit: cover;
  background: #101318;
  border: 1px solid var(--team-color-soft);
  border-radius: var(--radius-sm);
}

/* Lane glyphs are never mirrored with the row — top and bot read by their own
   orientation, so flipping them would swap what they mean. */
.lane-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: rgb(255 255 255 / 0.62);
}

.player-name {
  width: 96px;
  flex-shrink: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-column.mirrored .player-name {
  text-align: right;
}

.bar-track {
  flex: 1;
  min-width: 0;
  height: 12px;
  display: flex;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02)),
    var(--team-color-track);
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: var(--radius-xs);
}

.team-column.mirrored .bar-track {
  justify-content: flex-end;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-xs);
}

.damage-value {
  width: 46px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}

.team-column.mirrored .damage-value {
  text-align: right;
}

/* --- Entrance -------------------------------------------------------------
   Card rises into frame, then each row slides in from its outer edge and its
   bar wipes open behind it. Bars grow by clip-path, not width, so the
   damage-type segments keep their proportions while the fill is revealed.
   Both stagger off --row-i, so the two columns animate as mirrored pairs. */

.player-row {
  animation: damage-row-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--row-i, 0) * 70ms + 140ms);
}

@keyframes damage-row-in {
  from {
    opacity: 0;
    transform: translateX(-26px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.team-column.mirrored .player-row {
  animation-name: damage-row-in-mirrored;
}

@keyframes damage-row-in-mirrored {
  from {
    opacity: 0;
    transform: translateX(26px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.grow-right {
  animation: bar-grow-right 0.55s cubic-bezier(0.25, 1, 0.5, 1) both;
  animation-delay: calc(var(--row-i, 0) * 70ms + 300ms);
}

.grow-left {
  animation: bar-grow-left 0.55s cubic-bezier(0.25, 1, 0.5, 1) both;
  animation-delay: calc(var(--row-i, 0) * 70ms + 300ms);
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

.damage-panel-enter-active {
  transition:
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.3s ease;
}

.damage-panel-enter-from {
  opacity: 0;
  transform: translateY(28px);
}

/* --- Exit -----------------------------------------------------------------
   Last-in-first-out: rows retreat the way they arrived (support first), then
   the emptied card drops out of frame. The card's own transition is the
   longest thing on the element, so Vue unmounts only after the rows are gone. */

.damage-panel-leave-active {
  transition:
    transform 0.34s cubic-bezier(0.55, 0, 0.75, 0.06) 0.3s,
    opacity 0.24s ease 0.38s;
}

.damage-panel-leave-to {
  opacity: 0;
  transform: translateY(28px);
}

.damage-panel-leave-active .player-row {
  animation: damage-row-out 0.26s cubic-bezier(0.55, 0, 0.75, 0.06) both;
  animation-delay: calc((var(--row-count, 5) - 1 - var(--row-i, 0)) * 38ms);
}

@keyframes damage-row-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }

  to {
    opacity: 0;
    transform: translateX(-22px);
  }
}

.damage-panel-leave-active .team-column.mirrored .player-row {
  animation-name: damage-row-out-mirrored;
}

@keyframes damage-row-out-mirrored {
  from {
    opacity: 1;
    transform: translateX(0);
  }

  to {
    opacity: 0;
    transform: translateX(22px);
  }
}

/* The wipe holds its final state while the row itself fades away. */
.damage-panel-leave-active .bar-fill {
  animation-delay: 0s;
  animation-duration: 0s;
}

@media (prefers-reduced-motion: reduce) {
  .panel-header::after,
  .player-row,
  .bar-fill,
  .damage-panel-leave-active .player-row {
    animation: none;
  }

  .damage-panel-enter-active,
  .damage-panel-leave-active {
    transition: none;
  }
}
</style>
