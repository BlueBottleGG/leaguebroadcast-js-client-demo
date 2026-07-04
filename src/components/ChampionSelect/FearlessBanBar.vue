<script setup lang="ts">
import { computed } from 'vue'
import type { championSelectTeam, simpleChampionData } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { isMockCsEnabled } from './mock/mockChampSelect'

const props = defineProps<{
  blueTeam: championSelectTeam
  redTeam: championSelectTeam
}>()

const client = isMockCsEnabled() ? null : useClient()
const cacheUrl = (path?: string) => (client ? client.getCacheUrl(path) : (path ?? ''))

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
.fearless-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 52px;
  max-width: 1900px;
  padding: 5px 20px;
  background: linear-gradient(to bottom, rgba(6, 9, 15, 0.94), rgba(6, 9, 15, 0.78));
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

.game-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-right: 1px solid rgba(148, 163, 184, 0.12);
}
.side.red .game-group {
  border-right: none;
  border-left: 1px solid rgba(148, 163, 184, 0.12);
}
.game-group:last-child {
  border: none;
}

.game-label {
  font-family: 'Bebas Neue', sans-serif;
  font-size: calc(var(--fear-icon, 36px) * 0.42);
  letter-spacing: 1px;
  color: #94a3b8;
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
    rgba(148, 163, 184, 0),
    rgba(148, 163, 184, 0.5),
    rgba(148, 163, 184, 0)
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
