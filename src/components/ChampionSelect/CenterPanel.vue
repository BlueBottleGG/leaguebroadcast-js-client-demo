<script setup lang="ts">
import { computed } from 'vue'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useSmoothCountdown } from '@/composables/useChampSelect'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { isMockCsEnabled } from './mock/mockChampSelect'

const props = defineProps<{
  blueTeam: championSelectTeam
  redTeam: championSelectTeam
  bestOf: number
  timeRemaining: number
  phaseDuration: number
  activeSide: 'blue' | 'red' | null
}>()

const client = isMockCsEnabled() ? null : useClient()
const cacheUrl = (path?: string) => (client ? client.getCacheUrl(path) : (path ?? ''))

const dotCount = computed(() => (props.bestOf > 1 ? Math.floor(props.bestOf / 2) + 1 : 0))

const sides = computed(() => [
  { key: 'blue' as const, team: props.blueTeam },
  { key: 'red' as const, team: props.redTeam },
])

function teamName(team: championSelectTeam, fallback: string): string {
  return team.metaData?.tag || team.metaData?.name || fallback
}

function seasonRecord(team: championSelectTeam): string | null {
  const s = team.scoreSeason
  if (!s) return null
  return `${s.wins ?? 0}W – ${s.losses ?? 0}L`
}

const R = 46
const CIRC = 2 * Math.PI * R
const smoothTime = useSmoothCountdown(() => props.timeRemaining)
const dashOffset = computed(() => {
  if (!props.phaseDuration) return 0
  const pct = Math.max(0, Math.min(1, smoothTime.value / props.phaseDuration))
  return CIRC * (1 - pct)
})

function dotFilled(team: championSelectTeam, i: number) {
  return (team.scoreMatch?.wins ?? 0) >= i
}
</script>

<template>
  <div class="center-panel">
    <div
      v-for="side in sides"
      :key="side.key"
      class="half"
      :class="[side.key, { live: activeSide === side.key }]"
    >
      <div v-if="dotCount" class="dots">
        <span
          v-for="i in dotCount"
          :key="i"
          class="dot"
          :class="{ filled: dotFilled(side.team, i) }"
        />
      </div>

      <!-- timer ring wrapped around the team logo -->
      <div class="dial-wrap">
        <img
          v-if="side.team.metaData?.iconUri"
          class="team-icon"
          :src="cacheUrl(side.team.metaData.iconUri)"
          :alt="teamName(side.team, side.key)"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <div v-else class="icon-fallback" />
        <svg class="dial" viewBox="0 0 100 100">
          <circle class="track" cx="50" cy="50" :r="R" />
          <circle
            class="arc"
            cx="50"
            cy="50"
            :r="R"
            :stroke-dasharray="CIRC"
            :stroke-dashoffset="activeSide === side.key ? dashOffset : 0"
          />
        </svg>
      </div>

      <div class="name-block">
        <div class="team-name">
          {{ teamName(side.team, side.key === 'blue' ? 'BLUE' : 'RED') }}
        </div>
        <div v-if="seasonRecord(side.team)" class="team-record">
          {{ seasonRecord(side.team) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.center-panel {
  display: flex;
  height: 100%;
  padding: 0 4px;
  /* the center panel carries its own backing (the pick-strip no longer has one)
     so the dark plate rides in with it as it pops up */
  background: linear-gradient(to top, rgba(4, 6, 10, 0.92), rgba(4, 6, 10, 0.72));
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.55);
}

.half {
  width: 168px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px 8px;
}
.half.blue {
  border-right: 1px solid transparent;
  border-image: linear-gradient(
      to bottom,
      rgba(148, 163, 184, 0),
      rgba(148, 163, 184, 0.4),
      rgba(148, 163, 184, 0)
    )
    1;
}

.dots {
  display: flex;
  gap: 6px;
  align-items: center;
  height: 10px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(120, 130, 145, 0.55);
  transform: scale(0.8);
  transition:
    transform 0.3s ease,
    background 0.3s ease;
}
.blue .dot.filled {
  background: var(--blue-team-color);
  transform: scale(1);
}
.red .dot.filled {
  background: var(--red-team-color);
  transform: scale(1);
}

.dial-wrap {
  position: relative;
  width: 128px;
  height: 128px;
}
/* contain + margin-auto: centered, never crops square logos */
.team-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: 60%;
  max-height: 60%;
  width: auto;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}
.icon-fallback {
  position: absolute;
  inset: 16%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, rgba(30, 41, 59, 0.9), rgba(6, 9, 15, 0.95));
}
.dial {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
.track {
  fill: none;
  stroke: rgba(148, 163, 184, 0.18);
  stroke-width: 5;
}
/* dashoffset is driven per-frame by the smooth countdown — no CSS transition */
.arc {
  fill: none;
  stroke: rgba(148, 163, 184, 0.3);
  stroke-width: 5;
  stroke-linecap: round;
}
.blue.live .arc {
  stroke: var(--blue-team-color);
  filter: drop-shadow(0 0 4px var(--blue-team-color));
}
.red.live .arc {
  stroke: var(--red-team-color);
  filter: drop-shadow(0 0 4px var(--red-team-color));
}
.half:not(.live) .dial {
  opacity: 0.4;
}

.name-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.team-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 36px;
  line-height: 1;
  letter-spacing: 1px;
  color: #f1f5f9;
}
.blue .team-name {
  color: color-mix(in oklch, var(--blue-team-color) 65%, #ffffff);
}
.red .team-name {
  color: color-mix(in oklch, var(--red-team-color) 65%, #ffffff);
}
.team-record {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 14px;
  letter-spacing: 1px;
  color: #94a3b8;
  line-height: 1;
}
</style>
