<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  PickBanPhase,
  type championData,
  type championSelectTeam,
} from '@bluebottle_gg/league-broadcast-client'
import { useChampSelectData, useIsChampSelectActive } from '@/composables/useChampSelect'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { isMockCsEnabled } from './mock/mockChampSelect'
import PhaseTimerBar from './PhaseTimerBar.vue'
import BanRow from './BanRow.vue'
import PickCard from './PickCard.vue'
import CenterPanel from './CenterPanel.vue'
import FearlessBanBar from './FearlessBanBar.vue'
import CoachDisplay from './CoachDisplay.vue'

const isActive = useIsChampSelectActive()
const data = useChampSelectData()

// Local render gate. On an early exit we first end any in-flight pick/ban
// lock-in flourish (ban flash / featured pick), let the cards settle, and only
// then drop `rendered` so the scene plays its leave transition on a clean
// layout. Defined here; the exit watcher lives below the lock-in machinery.
const rendered = ref(isActive.value)

// Render from a frozen copy of the last active snapshot. On exit the backend
// clears champSelectData (empty teams, no timer) — reading it live would empty
// the pick-card v-for instantly (cards vanish instead of animating out) and
// feed NaN timings to the timer/center panel. Freezing lets the leave play over
// the final draft state; it re-syncs whenever champ select is active.
const frozenData = ref(data.value)
watch([data, isActive], () => {
  if (isActive.value) frozenData.value = data.value
})

const blueTeam = computed(() => frozenData.value.blueTeam)
const redTeam = computed(() => frozenData.value.redTeam)
const timer = computed(() => frozenData.value.timer)

// which side currently has an active pick/ban (drives colors + dials)
const activeSide = computed<'blue' | 'red' | null>(() => {
  const blueActive =
    blueTeam.value?.slots?.some((s) => s.isActive) || blueTeam.value?.bans?.some((b) => b.isActive)
  if (blueActive) return 'blue'
  const redActive =
    redTeam.value?.slots?.some((s) => s.isActive) || redTeam.value?.bans?.some((b) => b.isActive)
  if (redActive) return 'red'
  return null
})

// normalize bestOfType: numeric enum (1/2/3/5/7) or "BestOf5"-style string
const bestOf = computed(() => {
  const raw = frozenData.value.metaData?.bestOfType as unknown
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const m = raw.match(/\d+/)
    if (m) return Number(m[0])
  }
  return 1
})

// flex-grow compensation so the pick row keeps constant width regardless of
// how many cards a team has. Active card gets 1.6; the rest share the remainder.
function growInactive(n: number): number {
  if (n <= 1) return 1
  return (n - 1.6) / (n - 1)
}
const blueGrowInactive = computed(() => growInactive(blueTeam.value?.slots?.length ?? 0))
const redGrowInactive = computed(() => growInactive(redTeam.value?.slots?.length ?? 0))

const phaseTimerSide = computed(() => activeSide.value)

const client = isMockCsEnabled() ? null : useClient()
const cacheUrl = (path?: string) => (client ? client.getCacheUrl(path) : (path ?? ''))

// -- lock-in flashes ----------------------------------------------------------
// A ban locking splashes the banned champion across the whole team pick area,
// graying out before it leaves. A pick locking briefly expands that card to
// cover the team area, then collapses back.

interface BanFlash {
  champ: championData
  key: number
}
const banFlash = ref<{ blue: BanFlash | null; red: BanFlash | null }>({
  blue: null,
  red: null,
})
const featuredPick = ref<{ blue: number | null; red: number | null }>({
  blue: null,
  red: null,
})

let flashKey = 0
const lockTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function schedule(key: string, ms: number, fn: () => void) {
  clearTimeout(lockTimers[key])
  lockTimers[key] = setTimeout(fn, ms)
}
let exitTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => {
  Object.values(lockTimers).forEach(clearTimeout)
  clearTimeout(exitTimer)
})

function triggerBanFlash(side: 'blue' | 'red', champ: championData) {
  banFlash.value = { ...banFlash.value, [side]: { champ, key: ++flashKey } }
  schedule(`ban-${side}`, 2200, () => {
    banFlash.value = { ...banFlash.value, [side]: null }
  })
}
function triggerPickFeature(side: 'blue' | 'red', index: number) {
  featuredPick.value = { ...featuredPick.value, [side]: index }
  // long enough to read the champion statistics shown on the expanded card
  schedule(`pick-${side}`, 2400, () => {
    featuredPick.value = { ...featuredPick.value, [side]: null }
  })
}

// a slot "locks" when it goes active → inactive while holding a champion
function watchLocks(side: 'blue' | 'red', team: () => championSelectTeam | undefined) {
  watch(
    () => team()?.bans,
    (next, prev) => {
      if (!next || !prev) return
      next.forEach((b, i) => {
        if (prev[i]?.isActive && !b.isActive && b.champion) triggerBanFlash(side, b.champion)
      })
    },
  )
  watch(
    () => team()?.slots,
    (next, prev) => {
      if (!next || !prev) return
      next.forEach((s, i) => {
        if (prev[i]?.isActive && !s.isActive && s.champion) triggerPickFeature(side, i)
      })
    },
  )
}
watchLocks('blue', () => blueTeam.value)
watchLocks('red', () => redTeam.value)

// Drive the render gate off isActive, handling early exits: if a lock-in
// flourish is still playing, cut it immediately (cancel its timers, clear the
// state so the featured card collapses back), then hold briefly for the layout
// to settle before letting the scene animate out.
watch(isActive, (active) => {
  clearTimeout(exitTimer)
  if (active) {
    rendered.value = true
    return
  }
  const midLockIn =
    !!banFlash.value.blue ||
    !!banFlash.value.red ||
    featuredPick.value.blue !== null ||
    featuredPick.value.red !== null
  if (!midLockIn) {
    rendered.value = false
    return
  }
  Object.values(lockTimers).forEach(clearTimeout)
  banFlash.value = { blue: null, red: null }
  featuredPick.value = { blue: null, red: null }
  // let the featured card collapse (flex-grow 0.35s) before the leave starts
  exitTimer = setTimeout(() => {
    rendered.value = false
  }, 380)
})
</script>

<template>
  <Transition name="scene" :duration="{ enter: 2100, leave: 1000 }">
    <div v-if="rendered" class="champ-select-scene">
      <div class="fearless-wrap">
        <FearlessBanBar :blue-team="blueTeam" :red-team="redTeam" />
      </div>

      <div class="bottom-block">
        <div class="ban-strip">
          <div class="ban-cluster">
            <BanRow :bans="blueTeam.bans ?? []" team="blue" />
            <CoachDisplay :team="blueTeam" side="blue" />
          </div>
          <div class="ban-cluster">
            <CoachDisplay :team="redTeam" side="red" />
            <BanRow :bans="redTeam.bans ?? []" team="red" />
          </div>
        </div>

        <PhaseTimerBar
          :time-remaining="timer.timeRemaining"
          :phase-duration="timer.phaseDuration"
          :active-side="phaseTimerSide"
        />

        <div class="pick-strip">
          <div class="picks blue">
            <PickCard
              v-for="(slot, i) in blueTeam.slots ?? []"
              :key="`blue-${i}`"
              :slot="slot"
              team="blue"
              :team-data="blueTeam"
              :index="i"
              :grow-active="1.6"
              :grow-inactive="blueGrowInactive"
              :featured="featuredPick.blue === i"
              :collapsed="featuredPick.blue !== null && featuredPick.blue !== i"
            />
            <Transition name="ban-flash">
              <div v-if="banFlash.blue" :key="banFlash.blue.key" class="ban-flash team-blue">
                <img
                  class="bf-art"
                  :src="cacheUrl(banFlash.blue.champ.splashCenteredImg)"
                  :alt="banFlash.blue.champ.name"
                  @error="handleImageError"
                  @load="handleImageLoad"
                />
                <div class="bf-scrim" />
                <div class="bf-label">
                  <span class="bf-banned">BANNED</span>
                  <span class="bf-name">{{ banFlash.blue.champ.name }}</span>
                </div>
              </div>
            </Transition>
          </div>

          <CenterPanel
            :blue-team="blueTeam"
            :red-team="redTeam"
            :best-of="bestOf"
            :time-remaining="timer.timeRemaining"
            :phase-duration="timer.phaseDuration"
            :active-side="activeSide"
          />

          <div class="picks red">
            <PickCard
              v-for="(slot, i) in redTeam.slots ?? []"
              :key="`red-${i}`"
              :slot="slot"
              team="red"
              :team-data="redTeam"
              :index="i"
              :grow-active="1.6"
              :grow-inactive="redGrowInactive"
              :featured="featuredPick.red === i"
              :collapsed="featuredPick.red !== null && featuredPick.red !== i"
            />
            <Transition name="ban-flash">
              <div v-if="banFlash.red" :key="banFlash.red.key" class="ban-flash team-red">
                <img
                  class="bf-art"
                  :src="cacheUrl(banFlash.red.champ.splashCenteredImg)"
                  :alt="banFlash.red.champ.name"
                  @error="handleImageError"
                  @load="handleImageLoad"
                />
                <div class="bf-scrim" />
                <div class="bf-label">
                  <span class="bf-banned">BANNED</span>
                  <span class="bf-name">{{ banFlash.red.champ.name }}</span>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.champ-select-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* full-width flex wrapper: shrink-to-fit at left:50% would cap the bar at
   960px and force extra wrapping once fearless games pile up */
.fearless-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  display: flex;
  justify-content: center;
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
}

/* transparent between the ban groups so the game background shows through */
.bottom-block {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 1920px;
}

.ban-strip {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px 6px;
}

.ban-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pick-strip {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  /* cap the implicit row so tall center content can never stretch the cards */
  grid-template-rows: 100%;
  height: 260px;
  /* no backdrop here — the dark backing rides in per card (splash art) and with
     the center panel, so the row is transparent until pieces animate into view */
}

.picks {
  position: relative;
  display: flex;
  height: 100%;
}

/* ban lock-in: the banned champion splashes across the whole team pick area,
   grays out while it holds, then scales away */
.ban-flash {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  background: rgba(4, 6, 10, 0.85);
  pointer-events: none;
}
.bf-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  animation: bf-gray 2.2s ease-out forwards;
}
@keyframes bf-gray {
  0% {
    filter: saturate(1) brightness(1);
    transform: scale(1.12);
  }
  35% {
    filter: saturate(1) brightness(1);
    transform: scale(1.04);
  }
  100% {
    filter: saturate(0) brightness(0.55);
    transform: scale(1);
  }
}
.bf-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(4, 6, 10, 0.9),
    rgba(4, 6, 10, 0.15) 45%,
    rgba(4, 6, 10, 0.35)
  );
}
.ban-flash.team-blue {
  border-bottom: 3px solid var(--blue-team-color);
}
.ban-flash.team-red {
  border-bottom: 3px solid var(--red-team-color);
}

.bf-label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.bf-banned {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18px;
  letter-spacing: 8px;
  text-indent: 8px; /* recenter: letter-spacing adds a trailing gap */
  color: #94a3b8;
}
.team-blue .bf-banned {
  color: color-mix(in oklch, var(--blue-team-color) 60%, #ffffff);
}
.team-red .bf-banned {
  color: color-mix(in oklch, var(--red-team-color) 60%, #ffffff);
}
.bf-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 44px;
  line-height: 1;
  letter-spacing: 2px;
  color: #f1f5f9;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.ban-flash-enter-active {
  transition: opacity 0.25s ease-out;
}
.ban-flash-enter-from {
  opacity: 0;
}
.ban-flash-leave-active {
  transition:
    opacity 0.35s ease-in,
    transform 0.35s ease-in;
}
.ban-flash-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* scene transition — staged build-in: the stage rises with the center panel,
   then picks stagger, the timer wipes, bans pop, and finally coaches + the
   fearless bar (game by game, champ by champ within each game). Leave mirrors
   it in reverse, compressed. Timing is set by the :duration prop. */
.scene-enter-from .bottom-block {
  transform: translateY(105%);
}
.scene-enter-active .bottom-block {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 1 — center panel */
.scene-enter-from .center-panel {
  opacity: 0;
  transform: translateY(30px) scale(0.9);
}
.scene-enter-active .center-panel {
  transition:
    transform 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) 0.15s,
    opacity 0.35s ease 0.15s;
}

/* 2 — pick cards pop in from the center outward: the two innermost cards
   (one per team) spring up first, then each pair staggers toward the edges */
.scene-enter-from .pick-card {
  opacity: 0;
  transform: translateY(26px) scale(0.9);
}
.scene-enter-active .pick-card {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.34, 1.5, 0.64, 1),
    flex-grow 0.35s ease;
  transition-delay:
    calc(0.4s + var(--ci, 0) * 0.1s),
    calc(0.4s + var(--ci, 0) * 0.1s),
    0s;
}

/* 3 — timer bar wipes out from the center */
.scene-enter-from .phase-timer-bar {
  transform: scaleX(0);
}
.scene-enter-active .phase-timer-bar {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.85s;
}

/* 4 — ban slots pop in, staggered outward */
.scene-enter-from :deep(.ban-slot) {
  opacity: 0;
  transform: translateY(18px);
}
.scene-enter-active :deep(.ban-slot) {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.35s ease;
  transition-delay: calc(1s + var(--bi, 0) * 0.05s);
}

/* 5 — fearless bar drops in, icons follow game by game, champ by champ.
   Coaches run on the same cue via their own delayed show timer. */
.scene-enter-from .fearless-wrap {
  transform: translateY(-110%);
  opacity: 0;
}
.scene-enter-active .fearless-wrap {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 1.15s,
    opacity 0.3s ease 1.15s;
}
.scene-enter-from :deep(.fear-icon) {
  opacity: 0;
  transform: translateY(-12px);
}
.scene-enter-active :deep(.fear-icon) {
  transition:
    transform 0.35s ease,
    opacity 0.35s ease;
  transition-delay: calc(1.25s + var(--g, 0) * 0.12s + var(--c, 0) * 0.03s);
}

/* leave: reverse — fearless + coaches, bans, timer, picks, then the stage
   drops taking the center panel with it */
.scene-leave-active .fearless-wrap {
  transition:
    transform 0.3s cubic-bezier(0.5, 0, 0.75, 0),
    opacity 0.3s ease;
}
.scene-leave-to .fearless-wrap {
  transform: translateY(-110%);
  opacity: 0;
}
.scene-leave-active :deep(.coach-plate) {
  transition:
    transform 0.3s ease-in,
    opacity 0.3s ease;
}
.scene-leave-to :deep(.coach-plate) {
  transform: translateY(110%);
  opacity: 0;
}
.scene-leave-active :deep(.ban-slot) {
  transition:
    transform 0.25s ease-in,
    opacity 0.25s ease;
  transition-delay: calc(0.05s + var(--bi, 0) * 0.03s);
}
.scene-leave-to :deep(.ban-slot) {
  transform: translateY(18px);
  opacity: 0;
}
.scene-leave-active .phase-timer-bar {
  transition: transform 0.25s ease-in 0.2s;
}
.scene-leave-to .phase-timer-bar {
  transform: scaleX(0);
}
/* leave goes outside-to-in — mirror of the inside-to-out entrance */
.scene-leave-active .pick-card {
  transition:
    opacity 0.3s ease-in,
    transform 0.35s cubic-bezier(0.5, 0, 0.75, 0);
  transition-delay: calc(0.3s + var(--oi, 0) * 0.06s);
}
.scene-leave-to .pick-card {
  opacity: 0;
  transform: translateY(26px) scale(0.9);
}
.scene-leave-active .bottom-block {
  transition:
    transform 0.4s cubic-bezier(0.5, 0, 0.75, 0) 0.55s,
    opacity 0.4s ease 0.55s;
}
.scene-leave-to .bottom-block {
  transform: translateY(60%);
  opacity: 0;
}
</style>
