<script setup lang="ts">
import { computed } from 'vue'
import type { championSelectTeam, simpleChampionData } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'

const props = defineProps<{
  blueTeam: championSelectTeam
  redTeam: championSelectTeam
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

interface GameGroup {
  game: number // 1-based sequential label
  champs: simpleChampionData[]
}

// backend keys are 0-based (and possibly sparse); label sequentially by sorted
// key order as G1, G2, G3… regardless of the raw key values.
function toGroups(fb?: { [key: number]: simpleChampionData[] }): GameGroup[] {
  if (!fb) return []
  return Object.keys(fb)
    .map(Number)
    .sort((a, b) => a - b)
    .map((key) => ({ champs: fb[key] ?? [] }))
    .filter((g) => g.champs.length > 0)
    .map((g, i) => ({ game: i + 1, champs: g.champs }))
}

const blueGroups = computed(() => toGroups(props.blueTeam.fearlessBans))
const redGroups = computed(() => toGroups(props.redTeam.fearlessBans))

const hasData = computed(() => blueGroups.value.length > 0 || redGroups.value.length > 0)

// fearless drafts accumulate at most 4 prior games per team; at 4 games the
// icons drop to 30px so both sides stay on a single row within 1920px
const maxGroups = computed(() => Math.max(blueGroups.value.length, redGroups.value.length))
const iconSize = computed(() => (maxGroups.value <= 3 ? 36 : 30))
</script>

<template>
  <div v-if="hasData" class="fearless-bar" :style="{ '--fear-icon': `${iconSize}px` }">
    <div class="side blue">
      <div v-for="(grp, gi) in blueGroups" :key="`blue-g-${gi}`" class="game-group">
        <span class="game-label">G{{ grp.game }}</span>
        <TransitionGroup name="fear" tag="div" class="icons">
          <div
            v-for="(c, i) in grp.champs"
            :key="`blue-${gi}-${i}`"
            class="fear-icon blue"
            :style="{ '--g': gi, '--c': i }"
          >
            <img
              :src="cacheUrl(c.squareImg)"
              :alt="c.name"
              @error="handleImageError"
              @load="handleImageLoad"
            />
            <span class="strike" />
          </div>
        </TransitionGroup>
      </div>
    </div>

    <div class="center-divider" />

    <div class="side red">
      <div v-for="(grp, gi) in redGroups" :key="`red-g-${gi}`" class="game-group">
        <span class="game-label">G{{ grp.game }}</span>
        <TransitionGroup name="fear" tag="div" class="icons">
          <div
            v-for="(c, i) in grp.champs"
            :key="`red-${gi}-${i}`"
            class="fear-icon red"
            :style="{ '--g': gi, '--c': i }"
          >
            <img
              :src="cacheUrl(c.squareImg)"
              :alt="c.name"
              @error="handleImageError"
              @load="handleImageLoad"
            />
            <span class="strike" />
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* edge-to-edge strip at the very top of the scene; the game groups stay
   centered inside it */
.fearless-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 52px;
  width: 100%;
  padding: 5px 20px;
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.94), rgb(0 0 0 / 0.78));
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);
}

.side {
  display: flex;
  align-items: center;
  gap: 14px;
}
.side.blue {
  justify-content: flex-end;
}

/* hairline separators BETWEEN a side's game groups only: blue puts them on the
   right of every group but the last, red mirrors with left borders on every
   group but the first (so no stray line ends up beside the center divider) */
.game-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-right: 1px solid rgb(255 255 255 / 0.12);
}
.game-group:last-child {
  border-right: none;
}
.side.red .game-group {
  border-right: none;
  border-left: 1px solid rgb(255 255 255 / 0.12);
}
.side.red .game-group:first-child {
  border-left: none;
}

.game-label {
  font-weight: 800;
  font-size: calc(var(--fear-icon, 36px) * 0.38);
  letter-spacing: 0.5px;
  color: color-mix(in oklab, var(--broadcast-accent) 60%, #ffffff);
}

.icons {
  display: flex;
  gap: 4px;
}

.fear-icon {
  position: relative;
  width: var(--fear-icon, 36px);
  height: var(--fear-icon, 36px);
  border-radius: 3px;
  overflow: hidden;
}
.fear-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.5) brightness(0.75);
  display: block;
}
.fear-icon.blue {
  border-bottom: 2px solid var(--blue-team-color);
}
.fear-icon.red {
  border-bottom: 2px solid var(--red-team-color);
}
.strike {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.strike::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -10%;
  width: 120%;
  height: 1.5px;
  transform: rotate(-45deg);
}
.fear-icon.blue .strike::after {
  background: var(--blue-team-color);
  opacity: 0.7;
}
.fear-icon.red .strike::after {
  background: var(--red-team-color);
  opacity: 0.7;
}

.center-divider {
  width: 2px;
  align-self: stretch;
  margin: 8px 4px;
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in oklab, var(--broadcast-accent) 75%, transparent),
    transparent
  );
}

/* mid-draft additions (a new game's bans arriving); the initial scene
   build-in stagger is driven by ChampionSelectScene via --g / --c */
.fear-enter-active {
  transition:
    transform 0.4s ease,
    opacity 0.4s ease;
  transition-delay: calc(var(--c, 0) * 0.05s);
}
.fear-enter-from {
  transform: translateY(-16px);
  opacity: 0;
}
</style>
