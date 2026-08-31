<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, ref, watch } from 'vue'
import { type championData, type championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import { useChampSelectData, useIsChampSelectActive } from '@/composables/useChampSelect'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { playActionSound, preloadActionSounds } from '@/composables/useActionSounds'
import { useEventBranding } from '@/composables/useEventBranding'
import PhaseTimerBar from './PhaseTimerBar.vue'
import BanRow from './BanRow.vue'
import PickCard from './PickCard.vue'
import CenterPanel from './CenterPanel.vue'
import FearlessBanBar from './FearlessBanBar.vue'
import CoachDisplay from './CoachDisplay.vue'
import EventBrandPlate from './EventBrandPlate.vue'
import { CHAMPION_SELECT_TIMING, milliseconds } from './championSelectTiming'

// Three.js is a sizeable optional layer. Load it only while champion select is
// actually rendered so the regular in-game overlay does not pay that startup cost.
const ChampionStage3D = defineAsyncComponent(() => import('./3d/ChampionStage3D.vue'))
const HybridChampionModelLayer = defineAsyncComponent(
  () => import('./hybrid/HybridChampionModelLayer.vue'),
)

const props = withDefaults(
  defineProps<{
    enable3d?: boolean
    variant?: '2d' | '3d' | 'hybrid'
  }>(),
  { enable3d: false, variant: undefined },
)
const variant = computed(() => props.variant ?? (props.enable3d ? '3d' : '2d'))
const isThreeDimensionalStage = computed(() => variant.value === '3d')
const isHybrid = computed(() => variant.value === 'hybrid')

const isActive = useIsChampSelectActive()
const data = useChampSelectData()
const { eventLogoUrl, eventName, reload: reloadEventBranding } = useEventBranding()

// warm the pick/ban cues so the first lock-in doesn't decode late
preloadActionSounds()

// Local render gate. On an early exit we first end any in-flight pick/ban
// lock-in flourish (ban flash / featured pick), let the cards settle, and only
// then drop `rendered` so the scene plays its leave transition on a clean
// layout. Defined here; the exit watcher lives below the lock-in machinery.
const rendered = ref(isActive.value)
const sceneMounted = ref(rendered.value)
interface ChampionStageHandle {
  beginExit: () => void
}
const championStage = ref<ChampionStageHandle>()
const transitionDuration = computed(() =>
  isThreeDimensionalStage.value
    ? {
        enter: CHAMPION_SELECT_TIMING.scene.threeDimensional.enterMs,
        leave: CHAMPION_SELECT_TIMING.scene.threeDimensional.leaveMs,
      }
    : {
        enter: CHAMPION_SELECT_TIMING.scene.twoDimensional.enterMs,
        leave: CHAMPION_SELECT_TIMING.scene.twoDimensional.leaveMs,
      },
)
const sceneTimingStyle = computed(() => ({
  '--ban-flash-duration': milliseconds(CHAMPION_SELECT_TIMING.lockIn.banFlashMs),
}))

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

type DraftSide = 'blue' | 'red'
type BanSlotRef = { side: DraftSide; index: number }

const FIRST_BAN_ORDER: BanSlotRef[] = [
  { side: 'blue', index: 0 },
  { side: 'red', index: 0 },
  { side: 'blue', index: 1 },
  { side: 'red', index: 1 },
  { side: 'blue', index: 2 },
  { side: 'red', index: 2 },
]
const SECOND_BAN_ORDER: BanSlotRef[] = [
  { side: 'red', index: 3 },
  { side: 'blue', index: 3 },
  { side: 'red', index: 4 },
  { side: 'blue', index: 4 },
]
const BAN_ORDER = [...FIRST_BAN_ORDER, ...SECOND_BAN_ORDER]

function allBans() {
  return [...(blueTeam.value?.bans ?? []), ...(redTeam.value?.bans ?? [])]
}

function allPickSlots() {
  return [...(blueTeam.value?.slots ?? []), ...(redTeam.value?.slots ?? [])]
}

const hasTenLoadedPlayers = computed(() => {
  const slots = allPickSlots()
  return slots.length === 10 && slots.every((slot) => slot.player?.trim())
})

function activeBanCount(): number {
  return allBans().filter((ban) => ban.isActive).length
}

function lockedBanCount(): number {
  return allBans().filter((ban) => ban.champion && !ban.isActive).length
}

function lockedPickCount(): number {
  return allPickSlots().filter((slot) => slot.champion && !slot.isActive).length
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1))
}

const derivedActiveBan = computed<BanSlotRef | null>(() => {
  if (!hasTenLoadedPlayers.value || activeBanCount() <= 1) return null

  const bansLocked = lockedBanCount()
  if (bansLocked < FIRST_BAN_ORDER.length) {
    return FIRST_BAN_ORDER[clampIndex(bansLocked, FIRST_BAN_ORDER.length)] ?? null
  }
  if (bansLocked < BAN_ORDER.length && lockedPickCount() >= 6) {
    return BAN_ORDER[clampIndex(bansLocked, BAN_ORDER.length)] ?? null
  }
  return null
})

const hasMultiActiveBans = computed(() => hasTenLoadedPlayers.value && activeBanCount() > 1)

const blueBans = computed(() =>
  (blueTeam.value?.bans ?? []).map((ban, index) => ({
    ...ban,
    isActive: hasMultiActiveBans.value
      ? derivedActiveBan.value?.side === 'blue' && derivedActiveBan.value.index === index
      : ban.isActive,
  })),
)
const redBans = computed(() =>
  (redTeam.value?.bans ?? []).map((ban, index) => ({
    ...ban,
    isActive: hasMultiActiveBans.value
      ? derivedActiveBan.value?.side === 'red' && derivedActiveBan.value.index === index
      : ban.isActive,
  })),
)

// which side currently has an active pick/ban (drives colors + dials)
const activeSide = computed<'blue' | 'red' | null>(() => {
  if (derivedActiveBan.value) return derivedActiveBan.value.side

  const blueActive =
    blueTeam.value?.slots?.some((s) => s.isActive) || blueBans.value.some((b) => b.isActive)
  if (blueActive) return 'blue'
  const redActive =
    redTeam.value?.slots?.some((s) => s.isActive) || redBans.value.some((b) => b.isActive)
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

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

// -- lock-in flashes ----------------------------------------------------------
// A ban locking splashes the banned champion across the whole team pick area,
// graying out before it leaves. A pick lock can briefly present a full-area
// overlay of that card, then crossfade back to the fixed row.
const ENABLE_FULL_WIDTH_PICK_CARD = false

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
const blueFeaturedCard = computed(() => {
  const index = featuredPick.value.blue
  const slot = index === null ? undefined : blueTeam.value?.slots?.[index]
  return slot && index !== null ? { index, slot } : null
})
const redFeaturedCard = computed(() => {
  const index = featuredPick.value.red
  const slot = index === null ? undefined : redTeam.value?.slots?.[index]
  return slot && index !== null ? { index, slot } : null
})
const hybridReadyAliases = ref<Record<string, string>>({})

function handleHybridReadyChange(key: string, alias: string | null): void {
  const next = { ...hybridReadyAliases.value }
  if (alias) next[key] = alias
  else delete next[key]
  hybridReadyAliases.value = next
}

watch(isHybrid, (enabled) => {
  if (!enabled) hybridReadyAliases.value = {}
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
  playActionSound('ban')
  banFlash.value = { ...banFlash.value, [side]: { champ, key: ++flashKey } }
  schedule(`ban-${side}`, CHAMPION_SELECT_TIMING.lockIn.banFlashMs, () => {
    banFlash.value = { ...banFlash.value, [side]: null }
  })
}
function triggerPickFeature(side: 'blue' | 'red', index: number) {
  playActionSound('pick')
  if (!ENABLE_FULL_WIDTH_PICK_CARD) return
  featuredPick.value = { ...featuredPick.value, [side]: index }
  // long enough to read the champion statistics shown on the expanded card
  schedule(`pick-${side}`, CHAMPION_SELECT_TIMING.lockIn.pickFeatureMs, () => {
    featuredPick.value = { ...featuredPick.value, [side]: null }
  })
}

// A slot is "locked" once it holds a champion and is no longer the active
// pick/ban — the hover has been committed. We fire on the not-locked → locked
// transition rather than strictly on active → inactive, so a lock still counts
// even when the backend never sent an intermediate active frame (batched
// snapshots, a reconnect mid-draft, a fast lock). The length guard skips the
// initial population / reset (0 ↔ N slots) so picks already locked when the
// scene appears part-way through a draft don't retrigger a flash or a sound.
function isLocked(x?: { isActive?: boolean; champion?: championData }): boolean {
  return !!x?.champion && !x.isActive
}
function watchLocks(side: 'blue' | 'red', team: () => championSelectTeam | undefined) {
  watch(
    () => team()?.bans,
    (next, prev) => {
      if (!next || !prev || next.length !== prev.length) return
      next.forEach((b, i) => {
        if (b.champion && isLocked(b) && !isLocked(prev[i])) triggerBanFlash(side, b.champion)
      })
    },
  )
  watch(
    () => team()?.slots,
    (next, prev) => {
      if (!next || !prev || next.length !== prev.length) return
      next.forEach((s, i) => {
        if (isLocked(s) && !isLocked(prev[i])) triggerPickFeature(side, i)
      })
    },
  )
}
watchLocks('blue', () => blueTeam.value)
watchLocks('red', () => redTeam.value)

function beginSceneLeave(): void {
  // Vue freezes the leaving subtree as soon as `rendered` flips. Cue the
  // Three.js camera first so its long-shot move starts on the same frame as
  // the 2D leave choreography.
  championStage.value?.beginExit()
  rendered.value = false
}

function finishSceneLeave(): void {
  // `v-show` keeps the Three.js component and its animation loop alive while
  // the leave classes run. Only dispose it after the camera has reached the
  // long shot and the blackout has finished.
  if (!rendered.value) sceneMounted.value = false
}

// Drive the render gate off isActive, handling early exits: if a lock-in
// flourish is still playing, cut it immediately (cancel its timers, clear the
// state so the featured card collapses back), then hold briefly for the layout
// to settle before letting the scene animate out.
watch(isActive, (active) => {
  clearTimeout(exitTimer)
  if (active) {
    void reloadEventBranding()
    sceneMounted.value = true
    rendered.value = true
    return
  }
  const midLockIn =
    !!banFlash.value.blue ||
    !!banFlash.value.red ||
    featuredPick.value.blue !== null ||
    featuredPick.value.red !== null
  if (!midLockIn) {
    beginSceneLeave()
    return
  }
  Object.values(lockTimers).forEach(clearTimeout)
  banFlash.value = { blue: null, red: null }
  featuredPick.value = { blue: null, red: null }
  // Let the compositor-only featured overlay return before the leave starts.
  exitTimer = setTimeout(() => {
    beginSceneLeave()
  }, CHAMPION_SELECT_TIMING.lockIn.exitSettleMs)
})
</script>

<template>
  <template v-if="sceneMounted">
    <Transition appear name="scene" :duration="transitionDuration" @after-leave="finishSceneLeave">
      <div
        v-show="rendered"
        class="champ-select-scene"
        :class="{
          'champ-select-scene--3d': isThreeDimensionalStage,
          'champ-select-scene--hybrid': isHybrid,
        }"
        :style="sceneTimingStyle"
      >
        <ChampionStage3D
          v-if="isThreeDimensionalStage"
          ref="championStage"
          :active-side="activeSide"
          :blue-team="blueTeam"
          :draft-active="isActive"
          :event-logo-url="eventLogoUrl"
          :event-name="eventName"
          :red-team="redTeam"
          :blue-bans="blueBans"
          :red-bans="redBans"
        />

        <div v-if="isThreeDimensionalStage" class="scene-blackout" />

        <div class="fearless-wrap">
          <FearlessBanBar :blue-team="blueTeam" :red-team="redTeam" />
        </div>

        <div class="bottom-block">
          <div class="ban-strip">
            <div class="ban-cluster">
              <BanRow :bans="blueBans" team="blue" />
              <CoachDisplay :team="blueTeam" side="blue" />
            </div>
            <EventBrandPlate
              :meta-data="frozenData.metaData"
              :event-logo-url="eventLogoUrl"
              :event-name="eventName"
            />
            <div class="ban-cluster">
              <CoachDisplay :team="redTeam" side="red" />
              <BanRow :bans="redBans" team="red" />
            </div>
          </div>

          <PhaseTimerBar
            :time-remaining="timer.timeRemaining"
            :phase-duration="timer.phaseDuration"
            :active-side="phaseTimerSide"
          />

          <div class="pick-strip">
            <HybridChampionModelLayer
              v-if="isHybrid"
              :blue-team="blueTeam"
              :red-team="redTeam"
              :suppress-blue="featuredPick.blue !== null"
              :suppress-red="featuredPick.red !== null"
              @ready-change="handleHybridReadyChange"
            />
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
                :collapsed="featuredPick.blue !== null"
                :model-viewport="isHybrid ? `blue-${i}` : undefined"
                :model-ready="
                  !!slot.champion?.alias &&
                  hybridReadyAliases[`blue-${i}`] === slot.champion.alias
                "
                :class="{ 'edge-left': i === 0 }"
              />
              <Transition name="pick-feature">
                <PickCard
                  v-if="blueFeaturedCard"
                  :key="`feature-blue-${blueFeaturedCard.index}`"
                  class="pick-feature edge-left"
                  :slot="blueFeaturedCard.slot"
                  team="blue"
                  :team-data="blueTeam"
                  :index="blueFeaturedCard.index"
                  :grow-active="1"
                  :grow-inactive="1"
                  featured
                />
              </Transition>
              <Transition name="ban-flash">
                <div v-if="banFlash.blue" :key="banFlash.blue.key" class="ban-flash team-blue">
                  <img
                    class="bf-art bf-art-muted"
                    :src="cacheUrl(banFlash.blue.champ.splashCenteredImg)"
                    alt=""
                    aria-hidden="true"
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                  <img
                    class="bf-art bf-art-color"
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

            <CenterPanel :blue-team="blueTeam" :red-team="redTeam" :best-of="bestOf" />

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
                :collapsed="featuredPick.red !== null"
                :model-viewport="isHybrid ? `red-${i}` : undefined"
                :model-ready="
                  !!slot.champion?.alias && hybridReadyAliases[`red-${i}`] === slot.champion.alias
                "
                :class="{ 'edge-right': i === (redTeam.slots?.length ?? 0) - 1 }"
              />
              <Transition name="pick-feature">
                <PickCard
                  v-if="redFeaturedCard"
                  :key="`feature-red-${redFeaturedCard.index}`"
                  class="pick-feature edge-right"
                  :slot="redFeaturedCard.slot"
                  team="red"
                  :team-data="redTeam"
                  :index="redFeaturedCard.index"
                  :grow-active="1"
                  :grow-inactive="1"
                  featured
                />
              </Transition>
              <Transition name="ban-flash">
                <div v-if="banFlash.red" :key="banFlash.red.key" class="ban-flash team-red">
                  <img
                    class="bf-art bf-art-muted"
                    :src="cacheUrl(banFlash.red.champ.splashCenteredImg)"
                    alt=""
                    aria-hidden="true"
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                  <img
                    class="bf-art bf-art-color"
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
</template>

<style scoped>
.champ-select-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.scene-blackout {
  position: absolute;
  inset: 0;
  z-index: 4;
  background: #000000;
  opacity: 0;
  pointer-events: none;
}

/* full-width flex wrapper: shrink-to-fit at left:50% would cap the bar at
   960px and force extra wrapping once fearless games pile up. The fearless
   ban strip runs edge-to-edge at the very top; the studio background's caster
   cameras sit directly below it, so nothing else may hang from this strip
   (the sponsor plate lives in the bottom block for that reason). */
.fearless-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
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
  z-index: 2;
}

/* three columns: ban clusters pushed to the edges, the sponsor plate centered
   between them. Everything bottom-aligns so the plate sits flush on the phase
   timer bar (its tab styling depends on that) while the clusters keep their
   6px breathing room via their own margin. */
.ban-strip {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  padding: 8px 16px 0;
}

.ban-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.ban-cluster:first-child {
  justify-self: start;
}
.ban-cluster:last-child {
  justify-self: end;
}

.pick-strip {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  /* cap the implicit row so tall center content can never stretch the cards */
  grid-template-rows: 100%;
  height: 260px;
  /* flush, edge-to-edge strip with its own dark backing (same tone as the
     timer bar above it): the cards' rounded top corners open tiny notches at
     each seam, and those must show this backing — never the studio background */
  background: rgb(0 0 0 / 0.85);
}

.picks {
  position: relative;
  display: flex;
  height: 100%;
  overflow: hidden;
  contain: layout paint;
  z-index: 1;
}

.picks > .pick-feature {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  flex: none;
}

.pick-feature-enter-active,
.pick-feature-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.pick-feature-enter-from,
.pick-feature-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

/* ban lock-in: the banned champion splashes across the whole team pick area,
   grays out while it holds, then scales away */
.ban-flash {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  background: rgb(0 0 0 / 0.85);
  pointer-events: none;
}
.bf-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  animation: bf-zoom var(--ban-flash-duration) ease-out forwards;
  will-change: transform;
}
.bf-art-muted {
  filter: saturate(0) brightness(0.55);
}
.bf-art-color {
  animation:
    bf-zoom var(--ban-flash-duration) ease-out forwards,
    bf-color-fade var(--ban-flash-duration) ease-out forwards;
  will-change: transform, opacity;
}
@keyframes bf-zoom {
  0% {
    transform: scale(1.12);
  }
  35% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes bf-color-fade {
  0%,
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.bf-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgb(0 0 0 / 0.9), rgb(0 0 0 / 0.15) 45%, rgb(0 0 0 / 0.35));
}
.ban-flash.team-blue {
  border-bottom: 3px solid var(--blue-team-color);
  /* mirrors the cards it covers: rounded toward the center, square at the screen edge */
  border-radius: 0 6px 0 0;
}
.ban-flash.team-red {
  border-bottom: 3px solid var(--red-team-color);
  border-radius: 6px 0 0 0;
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
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 5px;
  text-indent: 5px; /* recenter: letter-spacing adds a trailing gap */
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.7);
}
.team-blue .bf-banned {
  color: color-mix(in oklch, var(--blue-team-color) 60%, #ffffff);
}
.team-red .bf-banned {
  color: color-mix(in oklch, var(--red-team-color) 60%, #ffffff);
}
.bf-name {
  font-weight: 900;
  font-size: 38px;
  line-height: 1;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #ffffff;
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
.scene-enter-from .champion-stage {
  opacity: 0;
  transform: scale(1.025);
}
.scene-enter-active .champion-stage {
  transition:
    opacity 0.75s ease-out,
    transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* The 3D route owns its entrance with a real camera move. Keep the canvas at
   full scale and reveal the initial overhead composition through a black
   curtain instead of applying the legacy flat layer fade. */
.champ-select-scene--3d.scene-enter-from .champion-stage,
.champ-select-scene--3d.scene-leave-to .champion-stage {
  opacity: 1;
  transform: none;
}
.champ-select-scene--3d.scene-enter-active .champion-stage,
.champ-select-scene--3d.scene-leave-active .champion-stage {
  transition: none;
}

.champ-select-scene--3d.scene-enter-from .scene-blackout {
  opacity: 1;
}
.champ-select-scene--3d.scene-enter-active .scene-blackout {
  transition: opacity 0.72s ease-in 0.14s;
}

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
    transform 0.5s cubic-bezier(0.34, 1.5, 0.64, 1);
  transition-delay: calc(0.4s + var(--ci, 0) * 0.1s), calc(0.4s + var(--ci, 0) * 0.1s);
}

/* 3 — timer bar wipes out from the center */
.scene-enter-from .phase-timer-bar {
  transform: scaleX(0);
}
.scene-enter-active .phase-timer-bar {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.85s;
}

/* 3b — sponsor plate rises from behind the timer bar right after the wipe */
.scene-enter-from .brand-plate {
  opacity: 0;
  transform: translateY(30px);
}
.scene-enter-active .brand-plate {
  transition:
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.95s,
    opacity 0.3s ease 0.95s;
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
.scene-leave-active .champion-stage {
  transition:
    opacity 0.55s ease 0.35s,
    transform 0.65s ease-in 0.35s;
}
.scene-leave-to .champion-stage {
  opacity: 0;
  transform: scale(1.015);
}

.champ-select-scene--3d.scene-leave-active .scene-blackout {
  transition: opacity 0.6s ease-in 0.55s;
}
.champ-select-scene--3d.scene-leave-to .scene-blackout {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .champ-select-scene--3d.scene-enter-active .scene-blackout,
  .champ-select-scene--3d.scene-leave-active .scene-blackout {
    transition-duration: 0.16s;
    transition-delay: 0s;
  }
}

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
.scene-leave-active .brand-plate {
  transition:
    transform 0.25s ease-in,
    opacity 0.25s ease;
}
.scene-leave-to .brand-plate {
  transform: translateY(30px);
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
