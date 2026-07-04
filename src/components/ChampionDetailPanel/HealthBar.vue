<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Current HP as a percentage of max (0-100). */
    progressPct?: number
    /** Ghost (recent-peak) HP as a percentage of max (0-100). Always >= progressPct. */
    ghostPct?: number
    /** Heal-chip floor as a percentage of max (0-100): left edge of the green gained-HP segment. */
    healFloorPct?: number
    /** True while the champion is alive and critically low on absolute HP (< 100). */
    lowHp?: boolean
    /** When true, the fill snaps to progressPct instantly instead of animating (e.g. on player switch). */
    noTransition?: boolean
  }>(),
  {
    progressPct: 0,
    ghostPct: 0,
    healFloorPct: 0,
    lowHp: false,
    noTransition: false,
  },
)

// Ghost segment should never render under the live fill (guards against float/rounding jitter).
const clampedGhostPct = computed(() => Math.max(props.progressPct, props.ghostPct))

// Green heal chip spans [healFloorPct, progressPct]; guard against float jitter giving negative width.
const healLeftPct = computed(() => Math.min(props.healFloorPct, props.progressPct))
const healWidthPct = computed(() => Math.max(0, props.progressPct - healLeftPct.value))
</script>

<template>
  <div class="health-bar-track" :class="{ 'is-low-hp': lowHp }">
    <div class="health-bar-ghost" :style="{ width: clampedGhostPct + '%' }"></div>
    <div
      class="health-bar-fill"
      :class="{ 'no-transition': noTransition }"
      :style="{ width: progressPct + '%' }"
    ></div>
    <div
      class="health-bar-heal"
      :style="{ left: healLeftPct + '%', width: healWidthPct + '%' }"
    ></div>
  </div>
</template>

<style lang="css" scoped>
.health-bar-track {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* Ghost "damage chip" segment: lighter/desaturated red, sits behind the live fill,
   holds at the recent peak then eases down (width is driven from script via JS RAF
   to match the hold+ease-out timing spec, not CSS transition, so it can hold-then-drain). */
.health-bar-ghost {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background-color: #c97a72;
}

.health-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  /* Matches the player scoreboard health bar (ProgressBar fill-color="green" === #008000). */
  background-color: #008000;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(0, 0, 0, 0));
  transition:
    width 0.15s linear,
    background-color 0.5s ease-in-out,
    background-image 0.5s ease-in-out;
}

/* Suppresses the width transition for one render (e.g. on player switch) so the bar snaps
   instead of animating from the previous player's value. */
.health-bar-fill.no-transition {
  transition: none;
}

/* Green "heal chip": bright segment over the newly gained HP, sits in front of the fill so a heal
   always reads green even while the underlying fill is in its low-HP red state. Width is driven
   from script (RAF) as the floor rises to meet the fill, so it shrinks and fades out on its own. */
.health-bar-heal {
  position: absolute;
  top: 0;
  bottom: 0;
  background-color: #8dffa0;
  box-shadow:
    0 0 5px rgba(120, 255, 150, 0.85),
    inset 0 0 3px rgba(255, 255, 255, 0.5);
}

/* ---------------- Low HP state ---------------- */
.health-bar-track.is-low-hp .health-bar-fill {
  background-color: #d9432f;
  background-image:
    linear-gradient(180deg, rgba(255, 200, 150, 0.22), rgba(0, 0, 0, 0)),
    linear-gradient(90deg, #b8241f, #e0592a);
}

/* Pulsing glow overlay, kept separate from .health-bar-fill so its entrance/exit can fade via
   `opacity` transition while the keyframe animation only drives the pulse itself. */
.health-bar-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
  box-shadow: inset 0 0 4px rgba(224, 60, 40, 0.25);
}

.health-bar-track.is-low-hp .health-bar-fill::after {
  opacity: 1;
  animation: hp-glow 1.4s ease-in-out infinite;
}

@keyframes hp-glow {
  0%,
  100% {
    box-shadow: inset 0 0 4px rgba(224, 60, 40, 0.25);
  }
  50% {
    box-shadow: inset 0 0 10px rgba(224, 60, 40, 0.65);
  }
}
</style>
