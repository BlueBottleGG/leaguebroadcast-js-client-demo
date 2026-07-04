<script setup lang="ts">
import { computed } from 'vue'
import type { championSelectTeam, pickSlot } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { resolvePlayerName } from '@/composables/useChampSelect'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { isMockCsEnabled } from './mock/mockChampSelect'
import TopIcon from '@/assets/lane/top-placeholder-cropped.svg?url'
import JungleIcon from '@/assets/lane/jgl-placeholder-cropped.svg?url'
import MidIcon from '@/assets/lane/mid-placeholder-cropped.svg?url'
import BotIcon from '@/assets/lane/bot-placeholder-cropped.svg?url'
import SupportIcon from '@/assets/lane/sup-placeholder-cropped.svg?url'

const props = defineProps<{
  slot: pickSlot
  team: 'blue' | 'red'
  teamData: championSelectTeam
  index: number
  growActive: number
  growInactive: number
  /** lock-in moment: this card briefly expands to cover the team area */
  featured?: boolean
  /** another card on this team is featured; shrink to nothing meanwhile */
  collapsed?: boolean
}>()

const client = isMockCsEnabled() ? null : useClient()
const cacheUrl = (path?: string) => (client ? client.getCacheUrl(path) : (path ?? ''))

const ROLE_ICONS = [TopIcon, JungleIcon, MidIcon, BotIcon, SupportIcon]
const roleIcon = computed(() => ROLE_ICONS[Math.min(props.index, 4)])

// distance from the center panel — blue picks grow outward to the left (so the
// innermost card is the last index), red picks outward to the right (innermost
// is index 0). Drives the inside-to-out stagger of the scene enter.
const slotCount = computed(() => props.teamData.slots?.length ?? 0)
const centerDist = computed(() =>
  props.team === 'blue' ? slotCount.value - 1 - props.index : props.index,
)
// distance from the outer edge — mirror of centerDist; drives the outside-to-in
// stagger of the scene leave.
const outerDist = computed(() => slotCount.value - 1 - centerDist.value)

const playerName = computed(() => resolvePlayerName(props.teamData, props.slot.player, props.index))
// names can run to 16 chars; shrink so they still fit an inactive card (~135px)
const nameSize = computed(() => {
  const len = playerName.value.length
  return len <= 10 ? 26 : Math.max(16, Math.floor(260 / len))
})
// Use the wide centered splash (same image the ban flash uses) for every state.
// The narrow card crops it to a vertical band; the featured card lets it fill
// the whole team area. One image means no reload/desync when a card expands.
const artSrc = computed(() => cacheUrl(props.slot.champion?.splashCenteredImg))

// hovering = active with a champion present (not yet locked)
const hovering = computed(() => props.slot.isActive && !!props.slot.champion)
const locked = computed(() => !props.slot.isActive && !!props.slot.champion)

// champion statistics arrive from the backend shortly after a pick locks;
// shown while the card is featured. Scale-agnostic: accepts 0–1 or 0–100.
function fmtPct(v: number): string {
  const pct = v <= 1 ? v * 100 : v
  return `${pct.toFixed(1)}%`
}
const stats = computed(() => {
  const s = props.slot.championStatistics
  if (!s) return null
  return [
    { label: 'WIN RATE', value: fmtPct(s.winRate) },
    { label: 'PICK RATE', value: fmtPct(s.pickRate) },
    { label: 'BAN RATE', value: fmtPct(s.banRate) },
  ]
})
</script>

<template>
  <div
    class="pick-card"
    :class="[
      `team-${team}`,
      { active: slot.isActive, hovering, locked, featured, collapsed, empty: !slot.champion },
    ]"
    :style="{
      '--grow-active': growActive,
      '--grow-inactive': growInactive,
      '--i': index,
      '--ci': centerDist,
      '--oi': outerDist,
    }"
  >
    <div class="art-wrap">
      <Transition name="art-fade">
        <img
          v-if="slot.champion"
          :key="artSrc"
          class="art"
          :class="{ hovering, locked, featured }"
          :src="artSrc"
          :alt="slot.champion.name"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <div v-else class="placeholder">
          <img class="role-icon" :src="roleIcon" alt="" />
        </div>
      </Transition>
    </div>

    <div class="depth-overlay" />
    <div class="scrim" />
    <div class="glow" />

    <div class="name" :style="{ fontSize: `${nameSize}px` }">
      {{ playerName }}
    </div>

    <Transition name="stats">
      <div v-if="featured && stats" class="featured-stats">
        <div v-for="(s, si) in stats" :key="s.label" class="stat" :style="{ '--si': si }">
          <span class="stat-value">{{ s.value }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pick-card {
  position: relative;
  flex-basis: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: rgba(8, 12, 20, 0.6);
  flex-grow: var(--grow-inactive, 1);
  transition:
    flex-grow 0.35s ease,
    border-width 0.35s ease;
}
.pick-card.active {
  flex-grow: var(--grow-active, 1.6);
}

/* empty slot: no champion yet — let the game background show through instead of
   a solid dark card (only the role placeholder + team edge remain) */
.pick-card.empty {
  background: transparent;
}

/* team-colored divider edge */
.pick-card.team-blue {
  border-right: 4px solid transparent;
  border-image: linear-gradient(to bottom, var(--blue-team-color), rgba(0, 0, 0, 0)) 1;
}
.pick-card.team-red {
  border-left: 4px solid transparent;
  border-image: linear-gradient(to bottom, var(--red-team-color), rgba(0, 0, 0, 0)) 1;
}

/* pick lock-in: the locked card sweeps over the whole team area for a moment
   (driven by the scene's featuredPick state), the rest shrink away */
.pick-card.featured {
  flex-grow: 200;
}
.pick-card.collapsed {
  flex-grow: 0.001;
  border-width: 0;
}

.art-wrap {
  position: absolute;
  inset: 0;
}
.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
  /* narrow card fills the splash's full height (centered champion), so the
     push-in grows downward from the top and never crops the head */
  transform-origin: 50% 0%;
  transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
/* full color while hovered; a slow push-in that settles back on lock */
.art.hovering {
  transform: scale(1.05);
}
/* featured: wide centered splash covering the whole team area — frame it like
   the ban flash (upper-center) rather than anchoring the zoom at the top edge */
.art.featured {
  object-position: center 25%;
  transform-origin: 50% 50%;
  transform: none;
}

/* in-place crossfade when the champion image changes (no translation) */
.art-fade-enter-active,
.art-fade-leave-active {
  transition: opacity 0.3s ease;
}
.art-fade-enter-from,
.art-fade-leave-to {
  opacity: 0;
}
.art-fade-leave-active {
  position: absolute;
  inset: 0;
}

.placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
.role-icon {
  width: 46px;
  height: 46px;
  opacity: 0.7;
  /* SVGs use currentColor (renders black as <img>); push near-white */
  filter: brightness(0) invert(1) drop-shadow(0 0 8px rgba(0, 0, 0, 0.85))
    drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
}

/* top-light / bottom-dark for depth */
.depth-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.06),
    rgba(0, 0, 0, 0) 35%,
    rgba(0, 0, 0, 0.35)
  );
}
/* bottom scrim for name legibility */
.scrim {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  pointer-events: none;
  background: linear-gradient(to top, rgba(4, 6, 10, 0.92), rgba(0, 0, 0, 0));
}

.glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.35s ease;
}
.pick-card.active .glow {
  opacity: 1;
  animation: card-pulse 3s ease-in-out infinite;
}
.team-blue.active .glow {
  box-shadow: inset 0 0 40px 4px var(--blue-team-color);
}
.team-red.active .glow {
  box-shadow: inset 0 0 40px 4px var(--red-team-color);
}
.pick-card.locked {
  animation: lock-flash 0.6s ease;
}
@keyframes card-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@keyframes lock-flash {
  0% {
    filter: brightness(1.6);
  }
  100% {
    filter: brightness(1);
  }
}

/* backend champion statistics, shown while the card is featured */
.featured-stats {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 56px;
  display: flex;
  justify-content: center;
  gap: 44px;
  pointer-events: none;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.stat-value {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 34px;
  line-height: 1;
  color: #f1f5f9;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}
.stat-label {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 12px;
  letter-spacing: 3px;
  color: #94a3b8;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

/* stats rise in one by one once the card has expanded */
.stats-enter-active .stat {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  transition-delay: calc(0.3s + var(--si, 0) * 0.08s);
}
.stats-enter-from .stat {
  opacity: 0;
  transform: translateY(12px);
}
.stats-leave-active {
  transition: opacity 0.15s ease;
}
.stats-leave-to {
  opacity: 0;
}

.name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  padding: 0 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 26px;
  letter-spacing: 1px;
  color: #f1f5f9;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
}
</style>
