<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
  formatDamage,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { buildDamageComposition, hasDamageComposition } from './damageCompositionData'

defineProps<{ sponsorLogo?: string; sponsorName?: string }>()

const TYPES = [
  { label: 'Physical', color: PHYS_COLOR },
  { label: 'Magic', color: MAGIC_COLOR },
  { label: 'True', color: TRUE_COLOR },
]
const LANES = ['TOP', 'JGL', 'MID', 'BOT', 'SUP']
const client = useClient()
const data = useIngameSelector((state) => state.gameData.damageComposition)
const roster = useIngameSelector((state) => state.gameData.scoreboardBottom)
const scoreboard = useIngameSelector((state) => state.gameData.scoreboard)
const visible = computed(() => hasDamageComposition(data.value))
const model = shallowRef(buildDamageComposition())
const teamNames = ref(['Blue team', 'Red team'])
const detailed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

// Preserve the last valid frame through the panel's exit. Feed updates do not
// replay the overview; only a new visible session starts the three-second hold.
watch(
  [data, roster, scoreboard],
  () => {
    if (!visible.value) return
    model.value = buildDamageComposition(data.value, roster.value)
    teamNames.value = ['Blue team', 'Red team'].map(
      (fallback, side) =>
        scoreboard.value?.teams[side]?.teamName ||
        roster.value?.teams[side]?.name ||
        scoreboard.value?.teams[side]?.teamTag ||
        fallback,
    )
  },
  { immediate: true },
)
watch(
  visible,
  (show) => {
    clearTimeout(timer)
    if (!show) return
    detailed.value = false
    timer = setTimeout(() => {
      detailed.value = true
    }, 3000)
  },
  { immediate: true },
)
onUnmounted(() => clearTimeout(timer))

function share(value: number | undefined, total: number | null): number {
  return total && value != null ? (value / total) * 100 : 0
}
function damage(value: number | null | undefined): string {
  return value == null ? '—' : formatDamage(value)
}
</script>

<template>
  <Transition name="composition-panel">
    <section
      v-if="visible"
      class="composition-panel"
      :class="{ 'is-detail': detailed }"
      aria-label="Damage composition"
    >
      <header class="panel-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>Damage composition</h2>
        <div class="legend" aria-label="Damage types">
          <span v-for="type in TYPES" :key="type.label">
            <i :style="{ background: type.color }" aria-hidden="true" />{{ type.label }}
          </span>
        </div>
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
        <div
          v-for="(team, side) in model.teams"
          :key="team.team"
          class="team-column"
          :class="side === 0 ? 'blue' : 'red'"
          :aria-label="teamNames[side]"
        >
          <h3 class="team-name" :title="teamNames[side]">{{ teamNames[side] }}</h3>
          <span class="team-total" :aria-label="'Total damage: ' + damage(team.total)">{{
            damage(team.total)
          }}</span>

          <div class="overview-bar" aria-hidden="true">
            <span
              v-for="(type, index) in TYPES"
              :key="type.label"
              :style="{
                background: type.color,
                width: share(team.values?.[index], team.total) + '%',
              }"
            />
          </div>

          <div
            v-for="(type, index) in TYPES"
            :key="type.label"
            class="percent-item"
            :style="{ '--type': index }"
          >
            <div class="percent-content">
              <span class="percent-number"
                ><i :style="{ background: type.color }" aria-hidden="true" />{{
                  team.values ? Math.round(share(team.values[index], team.total)) + '%' : '—'
                }}</span
              >
              <span class="percent-caption">{{ type.label }}</span>
            </div>
          </div>

          <div class="player-rows" :aria-hidden="!detailed">
            <div
              v-for="(player, lane) in team.players"
              :key="lane"
              class="player-row"
              :style="{ '--lane': lane }"
            >
              <div class="player-identity">
                <span class="champion-frame">
                  <img
                    v-if="player?.champion?.squareImg"
                    :src="client.getCacheUrl(player.champion.squareImg)"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                </span>
                <span class="player-name" :title="playerDisplayName(player)">{{
                  playerDisplayName(player, '—')
                }}</span>
              </div>
              <div class="player-track" aria-hidden="true">
                <div
                  class="player-bar"
                  :style="{ width: ((player?.total ?? 0) / model.maxDamage) * 100 + '%' }"
                >
                  <div class="player-fill">
                    <span
                      v-for="(type, index) in TYPES"
                      :key="type.label"
                      :style="{
                        background: type.color,
                        width: share(player?.values?.[index], player?.total ?? null) + '%',
                      }"
                    />
                  </div>
                </div>
              </div>
              <span class="player-value">{{ damage(player?.total) }}</span>
            </div>
          </div>
        </div>

        <div
          class="lane-labels"
          :aria-hidden="!detailed"
          :aria-label="model.paired ? 'Lane matchups' : 'Rank within each team'"
        >
          <span v-for="(lane, index) in LANES" :key="lane" :style="{ '--lane': index }">{{
            model.paired ? lane : '#' + (index + 1)
          }}</span>
        </div>
        <span class="scope">Champion damage · all game</span>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
/* Shared verbatim by both skins. Their global fonts, tokens and sponsor props
   provide the branding; the opaque takeover protects the scoreboard beneath. */
.composition-panel {
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
  --move-ease: cubic-bezier(0.22, 1, 0.36, 1);
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
.legend {
  display: flex;
  gap: 18px;
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.legend > span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend i {
  width: 10px;
  height: 10px;
}
.sponsor-logo {
  width: 28px;
  height: 28px;
  margin-left: 12px;
  object-fit: contain;
}
.comparison {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 34px;
  padding: 0 18px;
}
.team-column {
  position: relative;
  min-width: 0;
  --direction: 1;
  --origin: left top;
  --team-color: var(--blue-team-color);
}
.team-column.red {
  direction: rtl;
  --direction: -1;
  --origin: right top;
  --team-color: var(--red-team-color);
}
.team-name {
  position: absolute;
  left: 0;
  direction: ltr;
  top: 5px;
  max-width: 148px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--team-color);
  font-size: 18px;
  line-height: 22px;
  font-weight: 900;
  text-transform: uppercase;
}
.red .team-name {
  left: auto;
  right: 0;
  text-align: right;
}
.team-total {
  position: absolute;
  inset-inline-start: 0;
  top: 35px;
  font-size: 44px;
  line-height: 1;
  font-weight: 900;
  white-space: nowrap;
  transform-origin: var(--origin);
  transform: translate3d(0, 0, 0) scale(1);
  transition: transform 700ms var(--move-ease);
}
.is-detail .team-total {
  transform: translate3d(calc(var(--direction) * 162px), -31px, 0) scale(0.43);
}
.overview-bar {
  position: absolute;
  inset-inline: 0;
  top: 83px;
  height: 34px;
  display: flex;
  overflow: hidden;
  background: rgb(255 255 255 / 0.05);
  transform-origin: var(--origin);
  transform: scaleX(1);
}
.overview-bar > span,
.player-fill > span {
  display: block;
  height: 100%;
  flex-shrink: 0;
}
/* Collapse completely before any row grows: 320ms out + 60ms zero-width beat.
   Player arrivals settle decisively with an exponential-style ease, no bounce. */
.is-detail .overview-bar {
  transform: scaleX(0);
  transition: transform 320ms cubic-bezier(0.55, 0.055, 0.675, 0.19);
}
.percent-item {
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform: translate3d(calc(var(--direction) * var(--type) * 33.333%), 135px, 0);
  transition: transform 700ms var(--move-ease);
}
.percent-content {
  width: max-content;
  height: 57px;
  transform-origin: var(--origin);
  transform: scale(1);
  clip-path: inset(0);
  transition:
    transform 700ms var(--move-ease),
    clip-path 700ms var(--move-ease);
}
.percent-number {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 32px;
  font-weight: 900;
  line-height: 34px;
}
.percent-number i {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
}
.percent-caption {
  display: block;
  padding-inline-start: 16px;
  font-size: 12px;
  font-weight: 700;
  line-height: 20px;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.75);
}
.is-detail .percent-item {
  transform: translate3d(calc(var(--direction) * (58% + var(--type) * 14%)), 5px, 0);
}
.is-detail .percent-content {
  transform: scale(0.47);
  clip-path: inset(0 0 23px);
}
.player-rows {
  position: absolute;
  inset-inline: 0;
  top: 35px;
}
.player-row {
  height: 31px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.player-identity {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  min-width: 0;
  width: 126px;
}
.champion-frame {
  width: 25px;
  height: 25px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid color-mix(in oklab, var(--team-color) 50%, transparent);
  border-radius: var(--radius-sm);
  background: #101318;
}
.champion-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.player-name {
  direction: ltr;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 1;
  font-weight: 800;
}
.red .player-name {
  text-align: right;
}
.player-track {
  flex: 1;
  min-width: 0;
  height: 12px;
}
.player-bar {
  height: 100%;
}
.player-fill {
  display: flex;
  height: 100%;
  transform-origin: var(--origin);
  transform: scaleX(0);
}
.is-detail .player-fill {
  transform: scaleX(1);
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1) calc(380ms + var(--lane) * 20ms);
}
.player-value {
  width: 58px;
  flex-shrink: 0;
  text-align: end;
  white-space: nowrap;
  font-size: 21px;
  line-height: 1;
  font-weight: 900;
}
.player-identity,
.player-value {
  clip-path: inset(0 0 100%);
  transform: translate3d(calc(var(--direction) * -12px), 6px, 0);
}
.is-detail .player-identity,
.is-detail .player-value {
  clip-path: inset(0);
  transform: translate3d(0, 0, 0);
  transition:
    transform 300ms var(--move-ease) calc(430ms + var(--lane) * 20ms),
    clip-path 220ms var(--move-ease) calc(430ms + var(--lane) * 20ms);
}
.lane-labels {
  position: absolute;
  top: 35px;
  left: 50%;
  width: 34px;
  transform: translateX(-50%);
  display: grid;
  grid-template-rows: repeat(5, 31px);
  align-items: center;
  text-align: center;
  color: rgb(255 255 255 / 0.6);
  font-size: 11px;
  font-weight: 800;
}
.lane-labels > span {
  clip-path: inset(0 0 100%);
}
.is-detail .lane-labels > span {
  clip-path: inset(0);
  transition: clip-path 220ms var(--move-ease) calc(430ms + var(--lane) * 20ms);
}
.scope {
  position: absolute;
  bottom: 3px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  line-height: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.65);
}
.composition-panel-enter-active {
  transition:
    transform 300ms var(--move-ease),
    opacity 180ms ease;
}
.composition-panel-leave-active {
  transition:
    transform 180ms ease-in,
    opacity 160ms ease;
}
.composition-panel-enter-from,
.composition-panel-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .composition-panel,
  .composition-panel *,
  .composition-panel-enter-active,
  .composition-panel-leave-active {
    transition: none !important;
  }
}
</style>
