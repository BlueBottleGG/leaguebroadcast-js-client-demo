<script setup lang="ts">
import { computed } from 'vue'
import { Team, formatDamage, type ingameTeamfightTimelineData } from '@bluebottle_gg/league-broadcast-client'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { damagePath, gameClock, timelineX } from './teamfightTimelineData'

const props = defineProps<{
  data: ingameTeamfightTimelineData
  page: number
  sponsorLogo?: string
  sponsorName?: string
}>()

const killPages = computed(() => Math.max(1, Math.ceil(props.data.kills.length / 5)))
const kills = computed(() => props.data.kills.slice((props.page - 1) * 5, props.page * 5))
const maximum = computed(() => Math.max(
  1,
  props.data.blueTotalDamage,
  props.data.redTotalDamage,
  ...props.data.samples.flatMap((sample) => sample.teamCumulativeDamage),
))
const paths = computed(() => [0, 1].map((side) =>
  damagePath(props.data.samples, side as 0 | 1, props.data.startTime, props.data.endTime, maximum.value),
))
const name = (displayName: string, rawName: string) =>
  playerDisplayName({ displayName, name: rawName }, 'Unknown')
</script>

<template>
  <section class="timeline-panel" aria-label="Teamfight cumulative damage and kill sequence">
    <header class="panel-header">
      <span class="brand-marker" aria-hidden="true" />
      <h2>Teamfight timeline</h2>
      <span class="fight-time">{{ gameClock(data.startTime) }} · {{ gameClock(Math.max(0, data.endTime - data.startTime)) }}</span>
      <span v-if="killPages > 1" class="page-count">{{ page }} / {{ killPages }}</span>
      <img v-if="sponsorLogo" :src="sponsorLogo" :alt="sponsorName || 'Sponsor'" class="sponsor-logo" @error="handleImageError" @load="handleImageLoad" />
    </header>

    <div class="timeline-body">
      <div class="damage-history">
        <div class="chart-heading">
          <span class="team-total blue">Blue {{ formatDamage(data.blueTotalDamage) }}</span>
          <span class="chart-title">Cumulative damage</span>
          <span class="team-total red">{{ formatDamage(data.redTotalDamage) }} Red</span>
        </div>
        <svg
          v-if="data.samples.length"
          class="damage-chart"
          viewBox="0 0 480 112"
          role="img"
          :aria-label="`Cumulative damage: blue ${formatDamage(data.blueTotalDamage)}, red ${formatDamage(data.redTotalDamage)}`"
        >
          <line v-for="y in [12, 56, 100]" :key="y" x1="16" x2="464" :y1="y" :y2="y" class="chart-grid" />
          <path :d="paths[0]" class="curve blue" pathLength="1" />
          <path :d="paths[1]" class="curve red" pathLength="1" />
          <circle
            v-for="(kill, index) in data.kills"
            :key="`${kill.gameTime}:${kill.victimName}:${index}`"
            :cx="timelineX(kill.gameTime, data.startTime, data.endTime)"
            cy="106"
            r="4"
            class="kill-marker"
            :class="kill.killerTeam === Team.Order ? 'blue' : 'red'"
          />
        </svg>
        <div v-else class="no-samples">Collecting damage data</div>
        <div class="time-axis"><span>{{ gameClock(data.startTime) }}</span><span>{{ gameClock(data.endTime) }}</span></div>
      </div>

      <div class="kill-sequence">
        <div class="kill-heading">
          <span>Kill sequence</span>
          <strong><span class="blue">{{ data.blueKills }}</span>–<span class="red">{{ data.redKills }}</span></strong>
        </div>
        <ol v-if="kills.length" class="kill-list">
          <li
            v-for="(kill, index) in kills"
            :key="`${kill.gameTime}:${kill.victimName}:${index}`"
            class="kill-row"
            :class="kill.killerTeam === Team.Order ? 'blue-team' : 'red-team'"
            :style="{ '--row': index }"
          >
            <span class="kill-time">{{ gameClock(kill.gameTime) }}</span>
            <span class="killer" :title="name(kill.killerDisplayName, kill.killerName)">{{ name(kill.killerDisplayName, kill.killerName) }}</span>
            <span class="kill-arrow" aria-hidden="true">›</span>
            <span class="victim" :title="name(kill.victimDisplayName, kill.victimName)">{{ name(kill.victimDisplayName, kill.victimName) }}</span>
          </li>
        </ol>
        <div v-else class="no-kills">No kills in this fight</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.timeline-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 260px;
  overflow: hidden;
  pointer-events: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: white;
  background: #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  height: 46px;
  padding: 0 16px;
  background: #1a1d24;
  border-bottom: var(--brand-border-width) solid var(--border-color);
}
.brand-marker { width: 5px; height: 22px; flex-shrink: 0; background: var(--border-color); }
h2 { margin: 0; font-size: 23px; font-weight: 900; line-height: 1; text-transform: uppercase; white-space: nowrap; }
.fight-time { padding-left: 12px; border-left: 1px solid rgb(255 255 255 / 0.3); color: #d2d8e1; font-size: 16px; font-weight: 800; white-space: nowrap; }
.page-count { margin-left: auto; color: #d2d8e1; font-size: 13px; font-weight: 800; white-space: nowrap; }
.sponsor-logo { width: 28px; height: 28px; margin-left: auto; object-fit: contain; }
.page-count + .sponsor-logo { margin-left: 0; }
.timeline-body { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); gap: 18px; flex: 1; min-height: 0; padding: 14px 16px 12px; }
.damage-history, .kill-sequence { min-width: 0; }
.chart-heading, .kill-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 25px; font-size: 13px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
.chart-title { color: #bbc3cf; font-size: 11px; }
.team-total { font-size: 16px; }
.blue { color: var(--blue-team-color); }
.red { color: var(--red-team-color); }
.damage-chart { display: block; width: 100%; height: 128px; overflow: visible; }
.chart-grid { stroke: rgb(255 255 255 / 0.16); stroke-width: 1; stroke-dasharray: 4 4; }
.curve { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; animation: draw-curve 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.curve.blue { stroke: var(--blue-team-color); }
.curve.red { stroke: var(--red-team-color); animation-delay: 90ms; }
.kill-marker { stroke: #040508; stroke-width: 2; }
.kill-marker.blue { fill: var(--blue-team-color); }
.kill-marker.red { fill: var(--red-team-color); }
.time-axis { display: flex; justify-content: space-between; padding: 0 3px; color: #bbc3cf; font-size: 12px; font-weight: 700; }
.no-samples, .no-kills { display: grid; place-items: center; color: #bbc3cf; font-size: 14px; font-weight: 700; text-transform: uppercase; }
.no-samples { height: 128px; }
.no-kills { height: 145px; }
.kill-sequence { padding-left: 16px; border-left: 1px solid rgb(255 255 255 / 0.14); }
.kill-heading { font-size: 15px; }
.kill-heading strong { font-size: 21px; }
.kill-list { display: grid; grid-template-rows: repeat(5, 31px); margin: 0; padding: 0; list-style: none; }
.kill-row { display: grid; grid-template-columns: 42px minmax(0, 1fr) 14px minmax(0, 1fr); align-items: center; gap: 6px; min-width: 0; padding-left: 7px; border-top: 1px solid rgb(255 255 255 / 0.1); border-left: 2px solid var(--blue-team-color); font-size: 14px; font-weight: 800; animation: kill-row-in 350ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--row) * 55ms); }
.kill-row.red-team { border-left-color: var(--red-team-color); }
.kill-time { color: #bbc3cf; font-size: 12px; }
.killer, .victim { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kill-arrow { color: #bbc3cf; text-align: center; }
@keyframes draw-curve { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes kill-row-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
@media (prefers-reduced-motion: reduce) { .curve, .kill-row { animation: none; } }
</style>
