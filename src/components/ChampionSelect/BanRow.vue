<script setup lang="ts">
import type { banSlot } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { isMockCsEnabled } from './mock/mockChampSelect'

const props = defineProps<{
  bans: banSlot[]
  team: 'blue' | 'red'
}>()

const client = isMockCsEnabled() ? null : useClient()
const cacheUrl = (path?: string) => (client ? client.getCacheUrl(path) : (path ?? ''))
</script>

<template>
  <div class="ban-row" :class="`team-${team}`">
    <TransitionGroup name="ban">
      <div
        v-for="(ban, i) in bans"
        :key="i"
        class="ban-slot"
        :class="{ active: ban.isActive, empty: !ban.champion }"
        :style="{ '--bi': i }"
      >
        <img
          v-if="ban.champion"
          class="ban-img"
          :src="cacheUrl(ban.champion.squareImg)"
          :alt="ban.champion.name"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <span class="strike" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ban-row {
  display: flex;
  gap: 6px;
  height: 48px;
}
.team-red {
  flex-direction: row-reverse;
}

.ban-slot {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(10, 14, 22, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
}
.ban-slot.empty {
  background: rgba(6, 9, 15, 0.8);
}

/* matches the end state of the ban-flash gray-out in ChampionSelectScene */
.ban-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0) brightness(0.55);
}

/* diagonal strike in team color */
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
  height: 2px;
  transform: rotate(-45deg);
  transform-origin: center;
}
.team-blue .strike::after {
  background: var(--blue-team-color);
}
.team-red .strike::after {
  background: var(--red-team-color);
}
.ban-slot.empty .strike::after {
  display: none;
}

/* active ban: animated pulsing border ring + outer glow */
.team-blue .ban-slot.active {
  --ban-c: var(--blue-team-color);
}
.team-red .ban-slot.active {
  --ban-c: var(--red-team-color);
}
/* ring lives on ::after so it paints above the ban image */
.ban-slot.active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 3px;
  pointer-events: none;
  animation: ban-border 1.6s ease-in-out infinite;
}
@keyframes ban-border {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 2px var(--ban-c),
      0 0 3px 0 var(--ban-c);
    opacity: 0.75;
  }
  50% {
    box-shadow:
      inset 0 0 0 3px var(--ban-c),
      0 0 14px 2px var(--ban-c);
    opacity: 1;
  }
}

.ban-enter-active {
  transition:
    transform 0.4s ease,
    opacity 0.4s ease;
}
.ban-enter-from {
  transform: translateY(24px);
  opacity: 0;
}
</style>
