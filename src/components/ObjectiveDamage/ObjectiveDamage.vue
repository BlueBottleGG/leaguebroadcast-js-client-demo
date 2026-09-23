<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  formatDamage,
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import Baron from '@/assets/baron/baron.png'
import { buildObjectiveDamage, revealedObjectiveShare } from './objectiveDamageData'

const props = defineProps<{ sponsorLogo?: string; sponsorName?: string; suppressed?: boolean }>()
const emit = defineEmits<{ occupancy: [occupied: boolean] }>()
const client = useClient()
const data = useIngameSelector((state) => state.gameData.objectiveDps)
const scoreboard = useIngameSelector((state) => state.gameData.scoreboard)
const selected = computed(() => (props.suppressed ? null : buildObjectiveDamage(data.value)))
const frame = computed(() => {
  const next = selected.value
  if (!next) return null
  return {
    ...next,
    icon: /baron/i.test(next.name)
      ? Baron
      : client.getCacheUrl('style/ingame/objectives/dragonpit/dragon_square.png'),
    teams: next.teams.map((team) => ({
      ...team,
      name:
        scoreboard.value?.teams[team.team - 1]?.teamName ||
        scoreboard.value?.teams[team.team - 1]?.teamTag ||
        (team.team === 1 ? 'Blue team' : 'Red team'),
    })),
  }
})
// Freeze the complete frame on clear, including names and icon, until the exit finishes.
const model = shallowRef<NonNullable<typeof frame.value> | null>(null)
watch(
  frame,
  (next) => {
    if (next) {
      model.value = next
      emit('occupancy', true)
    }
  },
  { immediate: true },
)
function afterLeave() {
  if (!selected.value) {
    model.value = null
    emit('occupancy', false)
  }
}
const reveal = ref(1)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let revealFrame = 0

function stopReveal() {
  cancelAnimationFrame(revealFrame)
  revealFrame = 0
}
function prepareReveal() {
  stopReveal()
  reveal.value = reducedMotion.matches ? 1 : 0
}
function startReveal() {
  stopReveal()
  if (reducedMotion.matches) {
    reveal.value = 1
    return
  }
  const start = performance.now() + 240
  function tick(now: number) {
    const progress = Math.max(0, Math.min(1, (now - start) / 1100))
    reveal.value = 1 - (1 - progress) ** 3
    if (progress < 1) revealFrame = requestAnimationFrame(tick)
    else revealFrame = 0
  }
  revealFrame = requestAnimationFrame(tick)
}
function motionPreferenceChanged() {
  if (reducedMotion.matches) {
    stopReveal()
    reveal.value = 1
  }
}
reducedMotion.addEventListener('change', motionPreferenceChanged)
onUnmounted(() => {
  stopReveal()
  reducedMotion.removeEventListener('change', motionPreferenceChanged)
})

const revealedShare = (arc: { offset: number; share: number }) =>
  revealedObjectiveShare(reveal.value, arc.offset, arc.share)
const countingNumber = (value: number, target: number) =>
  target >= 1000 ? (value / 1000).toFixed(1) + 'k' : Math.round(value).toLocaleString('en-US')

const types = [
  { name: 'Physical', color: PHYS_COLOR },
  { name: 'Magic', color: MAGIC_COLOR },
  { name: 'True', color: TRUE_COLOR },
]
const teamColor = (team: number) =>
  team === 1 ? 'var(--blue-team-color)' : 'var(--red-team-color)'
const number = (value: number) =>
  value >= 1000 ? formatDamage(value) : Math.round(value).toLocaleString('en-US')
const percent = (share: number) => Math.round(share * 100) + '%'
const hasTypes = computed(() => model.value?.teams.some((team) => team.damage > 0 && team.types))
const missingTypes = computed(() =>
  model.value?.teams.some((team) => team.damage > 0 && !team.types),
)
const description = computed(
  () =>
    model.value?.teams
      .map(
        (team) =>
          team.name +
          ': ' +
          number(team.damage) +
          ' damage, ' +
          percent(team.share) +
          ' of total. ' +
          (team.types
            ? team.types.map((value, index) => types[index]!.name + ' ' + number(value)).join(', ')
            : 'Damage types unavailable.'),
      )
      .join(' ') || '',
)
</script>

<template>
  <Transition
    name="objective-damage"
    appear
    mode="out-in"
    @before-enter="prepareReveal"
    @enter="startReveal"
    @enter-cancelled="stopReveal"
    @before-leave="stopReveal"
    @after-leave="afterLeave"
  >
    <aside
      v-if="selected && model"
      :key="model.key"
      class="objective-damage-panel"
      aria-label="Objective damage per team"
    >
      <header class="panel-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>Objective<br />damage</h2>
        <img
          v-if="sponsorLogo"
          class="sponsor-logo"
          :src="sponsorLogo"
          :alt="sponsorName || 'Sponsor'"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </header>

      <h3 class="objective-name" :title="model.name">{{ model.name }}</h3>
      <div class="chart">
        <svg class="damage-ring" viewBox="0 0 220 220" role="img" :aria-label="description">
          <g transform="rotate(-90 110 110)" fill="none">
            <circle class="ring-track" cx="110" cy="110" r="88" stroke-width="18" />
            <circle
              v-for="team in model.teams.filter((team) => team.share > 0)"
              :key="team.team"
              class="team-arc"
              cx="110"
              cy="110"
              r="102"
              stroke-width="5"
              pathLength="100"
              :stroke="teamColor(team.team)"
              :stroke-dasharray="revealedShare(team) * 100 + ' 100'"
              :stroke-dashoffset="-team.offset * 100"
            />
            <circle
              v-for="(segment, index) in model.segments"
              :key="index"
              class="type-arc"
              cx="110"
              cy="110"
              r="88"
              stroke-width="18"
              pathLength="100"
              :stroke="segment.type == null ? '#59616e' : types[segment.type]!.color"
              :stroke-dasharray="revealedShare(segment) * 100 + ' 100'"
              :stroke-dashoffset="-segment.offset * 100"
            />
          </g>
          <g v-if="model.teams.every((team) => team.share > 0)" stroke="#040508" stroke-width="8">
            <line
              v-for="team in model.teams"
              :key="team.team"
              x1="110"
              y1="5"
              x2="110"
              y2="32"
              :transform="'rotate(' + team.offset * 360 + ' 110 110)'"
            />
          </g>
        </svg>
        <div class="chart-center" aria-hidden="true">
          <img
            :key="model.icon"
            :src="model.icon"
            alt=""
            @error="handleImageError"
            @load="handleImageLoad"
          />
          <strong>{{ countingNumber(model.total * reveal, model.total) }}</strong>
          <span>Total damage</span>
        </div>
      </div>

      <div class="type-legend">
        <template v-if="hasTypes">
          <span v-for="(type, index) in types" :key="type.name" :style="{ '--type-index': index }"
            ><i :style="{ background: type.color }" />{{ type.name }}</span
          >
          <span v-if="missingTypes"><i class="unknown" />Unknown</span>
        </template>
        <span v-else class="unavailable">Damage types unavailable</span>
      </div>

      <div class="teams">
        <div
          v-for="(team, index) in model.teams"
          :key="team.team"
          class="team-row"
          :style="{ '--row-index': index, '--team-color': teamColor(team.team) }"
        >
          <span class="team-marker" aria-hidden="true" />
          <span class="team-name" :title="team.name">{{ team.name }}</span>
          <strong class="team-share" aria-hidden="true">{{ percent(revealedShare(team)) }}</strong>
          <div class="team-damage">
            <strong aria-hidden="true">{{
              countingNumber(revealedShare(team) * model.total, team.damage)
            }}</strong
            ><span>Damage</span>
          </div>
        </div>
      </div>
      <footer>% of objective damage by team</footer>
    </aside>
  </Transition>
</template>

<style scoped>
.objective-damage-panel {
  width: 286px;
  overflow: hidden;
  pointer-events: none;
  background: #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: white;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 72px;
  padding: 0 16px;
  background: #1a1d24;
  border-bottom: 1px solid #313944;
}
.brand-marker {
  width: 5px;
  height: 40px;
  flex-shrink: 0;
  background: var(--border-color);
}
h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 900;
  line-height: 0.95;
  text-transform: uppercase;
}
.sponsor-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  margin-left: auto;
  object-fit: contain;
}
.objective-name {
  margin: 0;
  padding: 20px 16px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: 21px;
  font-weight: 800;
  line-height: 26px;
  text-transform: uppercase;
}
.chart {
  position: relative;
  width: 220px;
  height: 220px;
  margin: 0 auto;
}
.damage-ring {
  display: block;
  width: 100%;
  height: 100%;
}
.ring-track {
  stroke: #222833;
}
.chart-center {
  position: absolute;
  inset: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.chart-center img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  margin-bottom: 8px;
}
.chart-center strong {
  font-size: 39px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}
.chart-center span {
  margin-top: 6px;
  color: #bbc3cf;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.type-legend {
  min-height: 34px;
  padding: 6px 10px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}
.type-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #d2d8e1;
}
.type-legend i {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-xs);
}
.type-legend .unknown {
  background: #59616e;
}
.type-legend .unavailable {
  color: #bbc3cf;
}
.teams {
  padding: 0 18px;
}
.team-row {
  display: grid;
  grid-template-columns: 11px minmax(0, 1fr) auto;
  column-gap: 9px;
  align-items: center;
  padding: 15px 0;
}
.team-row + .team-row {
  border-top: 1px solid #313944;
}
.team-marker {
  width: 11px;
  height: 11px;
  border-radius: var(--radius-xs);
  background: var(--team-color);
}
.team-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
}
.team-share {
  min-width: 3.6ch;
  text-align: right;
  grid-column: 3;
  grid-row: 1 / 3;
  align-self: center;
  font-size: 33px;
  font-weight: 900;
  line-height: 1;
}
.team-damage {
  grid-column: 2;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 3px;
}
.team-damage strong {
  font-size: 25px;
  font-weight: 800;
  line-height: 1;
}
.team-damage span {
  color: #bbc3cf;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
footer {
  height: 32px;
  display: grid;
  place-items: center;
  border-top: 1px solid #313944;
  color: #bbc3cf;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.panel-header > *,
.objective-name,
.chart,
.chart-center > *,
.type-legend > span,
.team-row,
footer {
  transition:
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 360ms ease;
  transition-delay: var(--reveal-delay, 80ms);
}
.brand-marker {
  transform-origin: center;
  --reveal-delay: 40ms;
}
.sponsor-logo {
  --reveal-delay: 180ms;
}
.objective-name {
  --reveal-delay: 160ms;
}
.chart {
  --reveal-delay: 180ms;
}
.chart-center img {
  --reveal-delay: 280ms;
}
.chart-center strong {
  --reveal-delay: 320ms;
}
.chart-center span {
  --reveal-delay: 400ms;
}
.type-legend > span {
  --reveal-delay: calc(620ms + var(--type-index, 0) * 90ms);
}
.team-row {
  --reveal-delay: calc(320ms + var(--row-index) * 150ms);
}
footer {
  --reveal-delay: 980ms;
}
.objective-damage-enter-active {
  transition:
    transform 440ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 320ms ease;
}
.objective-damage-leave-active {
  transition:
    transform 320ms cubic-bezier(0.55, 0, 0.75, 0.06),
    opacity 260ms ease 60ms;
}
.objective-damage-enter-from,
.objective-damage-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.objective-damage-enter-from .panel-header > *,
.objective-damage-enter-from .objective-name,
.objective-damage-enter-from .chart-center > *,
.objective-damage-enter-from .type-legend > span,
.objective-damage-enter-from .team-row,
.objective-damage-enter-from footer {
  transform: translateY(10px);
  opacity: 0;
}
.objective-damage-enter-from .brand-marker {
  transform: scaleY(0);
}
.objective-damage-enter-from .chart {
  transform: scale(0.94);
  opacity: 0;
}
.objective-damage-enter-from .chart-center img {
  transform: scale(0.75);
}
.objective-damage-leave-active .chart,
.objective-damage-leave-active .chart-center > *,
.objective-damage-leave-active .type-legend > span,
.objective-damage-leave-active .team-row,
.objective-damage-leave-active footer {
  transition-duration: 180ms;
  transition-delay: 0ms;
}
.objective-damage-leave-to .chart {
  transform: scale(0.94);
  opacity: 0;
}
.objective-damage-leave-to .type-legend > span,
.objective-damage-leave-to .team-row,
.objective-damage-leave-to footer {
  transform: translateX(-10px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .objective-damage-enter-active,
  .objective-damage-leave-active,
  .panel-header > *,
  .objective-name,
  .chart,
  .chart-center > *,
  .type-legend > span,
  .team-row,
  footer {
    transition: none;
  }
}
</style>
