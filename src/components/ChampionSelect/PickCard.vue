<script setup lang="ts">
import { computed } from 'vue'
import type {
  championSelectTeam,
  championStatistics,
  pickSlot,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { resolvePlayerName } from '@/composables/useChampSelect'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
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
  /** shared hybrid-canvas viewport represented by this card */
  modelViewport?: string
  /** the matching model is attached and safe to reveal */
  modelReady?: boolean
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

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
// Name sizing is driven in CSS from the card's own width (container query) and
// the name length, so it fits whatever width the card currently has — narrow
// inactive/empty cards shrink the text instead of clipping it, wide active cards
// let it grow up to the cap. We only need to expose the length here.
const nameLen = computed(() => Math.max(playerName.value.length, 1))
// Use the wide centered splash (same image the ban flash uses) for every state.
// The narrow card crops it to a vertical band; the featured card lets it fill
// the whole team area. One image means no reload/desync when a card expands.
const artSrc = computed(() => cacheUrl(props.slot.champion?.splashCenteredImg))

// hovering = active with a champion present (not yet locked)
const hovering = computed(() => props.slot.isActive && !!props.slot.champion)
const locked = computed(() => !props.slot.isActive && !!props.slot.champion)

type PickSlotWithStatisticsBySource = pickSlot & {
  championStatisticsBySource?: {
    tournament?: championStatistics
  }
}

// champion statistics arrive from the backend shortly after a pick locks;
// shown while the card is featured. Scale-agnostic: accepts 0-1 or 0-100.
function fmtPct(v: number): string {
  const pct = v <= 1 ? v * 100 : v
  return `${pct.toFixed(1)}%`
}
function hasPresence(s?: championStatistics): s is championStatistics {
  return !!s && ((s.pickRate ?? 0) > 0 || (s.banRate ?? 0) > 0)
}
const stats = computed(() => {
  const slot = props.slot as PickSlotWithStatisticsBySource
  const s = slot.championStatisticsBySource?.tournament
  if (!hasPresence(s)) return null

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
      {
        active: slot.isActive,
        hovering,
        locked,
        featured,
        collapsed,
        empty: !slot.champion,
        'hybrid-viewport': !!modelViewport,
        'model-ready': modelReady,
      },
    ]"
    :data-model-viewport="modelViewport"
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
          :class="{ hovering, locked, featured, 'model-ready': modelReady }"
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

    <div v-if="modelReady" class="model-corner-masks" aria-hidden="true">
      <span class="model-corner-mask model-corner-mask--left" />
      <span class="model-corner-mask model-corner-mask--right" />
    </div>

    <div class="depth-overlay" />
    <div class="scrim" />
    <div class="glow" />

    <div class="name" :style="{ '--name-len': nameLen }">
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
  /* let the name size itself from this card's live width (see .name) */
  container-type: inline-size;
  /* opaque backing on every card, empty or not — the studio background must
     never bleed through the pick strip. Corner rounding shows against the
     strip's own dark backing, never against the studio background. */
  background: rgb(0 0 0 / 0.78);
  border-radius: 6px 6px 0 0;
  flex-grow: var(--grow-inactive, 1);
  /* Matching curves keep the row's total flex allocation stable while the
     active slot hands its extra width to the next card. */
  transition:
    flex-grow 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.35s ease,
    transform 0.35s ease;
}

.pick-card.active {
  flex-grow: var(--grow-active, 1.6);
}

.pick-card.hybrid-viewport.model-ready {
  background: transparent;
}

/* team-colored edge on the center-facing side, drawn INSIDE the tile — a real
   border would sit outside the art box and show the studio background through
   its transparent lower half */
.pick-card::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  pointer-events: none;
  transition: opacity 0.35s ease;
}

.pick-card.team-blue::after {
  right: 0;
  background: linear-gradient(to bottom, var(--blue-team-color), rgba(0, 0, 0, 0));
}

.pick-card.team-red::after {
  left: 0;
  background: linear-gradient(to bottom, var(--red-team-color), rgba(0, 0, 0, 0));
}

.pick-card.collapsed::after {
  opacity: 0;
}

/* outermost cards sit flush against the screen edge — no rounding there
   (classes set by the scene on the first blue / last red card) */
.pick-card.edge-left {
  border-top-left-radius: 0;
}
.pick-card.edge-right {
  border-top-right-radius: 0;
}

.pick-card.collapsed {
  opacity: 0;
  transform: scale(0.985);
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
  transition:
    transform 0.8s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.art.model-ready {
  opacity: 0;
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

.model-corner-masks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.model-corner-mask {
  position: absolute;
  top: 0;
  width: 6px;
  height: 6px;
}

.model-corner-mask--left {
  left: 0;
  background: radial-gradient(circle at bottom right, transparent 0 5.5px, rgb(0 0 0 / 0.85) 6px);
}

.model-corner-mask--right {
  right: 0;
  background: radial-gradient(circle at bottom left, transparent 0 5.5px, rgb(0 0 0 / 0.85) 6px);
}

.pick-card.edge-left .model-corner-mask--left,
.pick-card.edge-right .model-corner-mask--right {
  display: none;
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
  background: linear-gradient(to top, rgb(0 0 0 / 0.92), rgb(0 0 0 / 0));
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

.pick-card.locked .glow {
  background: rgba(255, 255, 255, 0.72);
  animation: lock-flash 0.6s ease-out;
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
    opacity: 0.55;
  }

  100% {
    opacity: 0;
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
  font-weight: 900;
  font-size: 30px;
  line-height: 1;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.stat-label {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--broadcast-accent) 55%, #ffffff);
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
  text-overflow: ellipsis;
  font-weight: 800;
  text-transform: uppercase;
  /* Fit the name to the card: width budget per char is (card width / length);
     the factor converts that budget into a font-size that fills the card
     without overflowing — 1.3 is calibrated for bold display caps, which
     run wider than a condensed display face. Capped at 21px so short names on
     wide active cards don't balloon; floored at 11px so it stays legible. */
  font-size: clamp(11px, calc(130cqw / var(--name-len, 10)), 21px);
  letter-spacing: 0.5px;
  color: #ffffff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
}
</style>
