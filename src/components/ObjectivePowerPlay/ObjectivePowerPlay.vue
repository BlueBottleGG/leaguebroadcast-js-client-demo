<script setup lang="ts">
import { useGameClock } from '@/composables/useGameClock'
import { Team, type ingameObjectivePowerPlay } from '@bluebottle_gg/league-broadcast-client'
import { computed, ref, watch } from 'vue'
import { usePowerPlaySlot } from '@/composables/usePowerPlayStack'
import Baron from '@/assets/baron/baron.png'
import Elder from '@/assets/dragon/elder.png'
import BroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'

const props = withDefaults(
  defineProps<{
    team: Team
    mirror?: boolean
    powerPlay?: ingameObjectivePowerPlay
    type?: 'baron' | 'dragon'
  }>(),
  {
    mirror: false,
  },
)
const gameTime = useGameClock()
const hasPowerPlay = computed(() => {
  return (
    props.powerPlay !== undefined &&
    props.powerPlay.timeEnd > gameTime.value &&
    props.powerPlay.timeStart <= gameTime.value
  )
})

function getPowerPlayProgress(powerPlay: ingameObjectivePowerPlay | undefined) {
  if (!powerPlay) return 0
  const totalDuration = powerPlay.timeEnd - powerPlay.timeStart
  const elapsed = gameTime.value - powerPlay.timeStart
  const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1)
  return progress
}

function formatGoldDiff(gold: number) {
  if (gold >= 1000) {
    return `+${(gold / 1000).toFixed(1)}k g`
  } else if (gold <= -1000) {
    return `${(gold / 1000).toFixed(1)}k g`
  } else {
    return `${Math.round(gold)} g`
  }
}

const powerPlayProgress = computed(() => getPowerPlayProgress(props.powerPlay))

// The template reads the bar through this rather than the raw progress: tenth-of-a-percent
// steps are sub-pixel on the track, while the unrounded value changes every animation frame.
const timerBarWidth = computed(() => {
  if (props.type !== 'baron' && props.type !== 'dragon') return '0%'
  return `${((1 - powerPlayProgress.value) * 100).toFixed(1)}%`
})
const timeRemaining = computed(() => {
  if (!hasPowerPlay.value) return 0
  const remaining = props.powerPlay!.timeEnd - gameTime.value
  return `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(remaining % 60)
    .toString()
    .padStart(2, '0')}`
})

const goldDiff = computed(() => {
  if (!props.powerPlay) return ' - '
  return formatGoldDiff(props.powerPlay.gold)
})

const showCompletion = ref(false)
const completionGold = ref(0)
const formattedCompletionGold = computed(() => {
  const gold = completionGold.value
  const sign = gold >= 0 ? '+' : '-'
  const abs = Math.abs(gold)
  return `${sign}${abs >= 1000 ? (abs / 1000).toFixed(1) + 'k' : Math.round(abs)}`
})
const completionType = ref<'baron' | 'dragon'>('baron')
let completionTimer: ReturnType<typeof setTimeout> | null = null

watch(hasPowerPlay, (newVal, oldVal) => {
  if (oldVal && !newVal && props.powerPlay && props.type) {
    completionGold.value = props.powerPlay.gold
    completionType.value = props.type
    showCompletion.value = true
    if (completionTimer) clearTimeout(completionTimer)
    completionTimer = setTimeout(() => {
      showCompletion.value = false
      completionTimer = null
    }, 4000)
  }
  if (newVal) {
    showCompletion.value = false
    if (completionTimer) {
      clearTimeout(completionTimer)
      completionTimer = null
    }
  }
})

/* Publish this card's footprint so overlays anchored below the stack (e.g. the
   smite reaction card on the Chaos side) can keep clear of it. The active card
   and the completion popup share the same slot. */
usePowerPlaySlot(
  props.team,
  computed(() => hasPowerPlay.value || showCompletion.value),
)
</script>

<template>
  <div class="pp-container">
    <Transition name="pp">
      <div v-if="hasPowerPlay" key="active" class="power-play" :class="{ mirror: props.mirror }">
        <div class="pp-body">
          <p class="power-play-text">
            {{ props.type === 'baron' ? 'Baron' : props.type === 'dragon' ? 'Dragon' : '' }} Power
            Play
          </p>
          <div
            class="power-play-content"
            :style="{
              background: `linear-gradient(90deg, transparent, transparent), linear-gradient(90deg, var(--${props.type === 'baron' ? 'baron' : 'elder'}-color-subtle) 0%, transparent 45%, transparent 55%, var(--${props.type === 'baron' ? 'baron' : 'elder'}-color-subtle) 100%)`,
            }"
          >
            <div>
              <p>{{ goldDiff }}</p>
              <p>{{ timeRemaining }}</p>
            </div>

            <img
              :src="props.type === 'baron' ? Baron : props.type === 'dragon' ? Elder : ''"
              @error="handleImageError"
              @load="handleImageLoad"
              class="power-play-icon"
              :style="{
                border:
                  props.type === 'baron'
                    ? '2px solid var(--baron-color)'
                    : props.type === 'dragon'
                      ? '2px solid var(--elder-color)'
                      : 'none',
              }"
            />
          </div>
          <div class="power-play-timer" :class="{ mirror: props.mirror }">
            <div
              class="power-play-timer-bar"
              :class="{ elder: props.type === 'dragon', baron: props.type === 'baron' }"
              :style="{ width: timerBarWidth }"
            ></div>
          </div>
        </div>

        <!-- Project brand rail: enters as a full-card splash, collapses into a side rail -->
        <div class="brand-rail">
          <p class="presented-by">presented by</p>
          <img :src="BroadcastLogo" alt="League Broadcast" class="brand-rail-logo" />
        </div>
      </div>

      <div
        v-else-if="showCompletion"
        key="complete"
        class="power-play-completion"
        :class="[completionType, { mirror: props.mirror }]"
      >
        <div class="completion-body">
          <img
            :src="completionType === 'baron' ? Baron : Elder"
            @error="handleImageError"
            @load="handleImageLoad"
            class="completion-icon"
            :style="{
              border:
                completionType === 'baron'
                  ? '2px solid var(--baron-color)'
                  : '2px solid var(--elder-color)',
            }"
          />
          <p
            class="completion-gold"
            :style="{
              color: completionType === 'baron' ? 'var(--baron-color)' : 'var(--elder-color)',
            }"
          >
            {{ formattedCompletionGold }}
          </p>
        </div>

        <div class="brand-rail static">
          <img :src="BroadcastLogo" alt="League Broadcast" class="brand-rail-logo" />
        </div>

        <!-- Accent outro: the project color takes over before the card fades out -->
        <div class="completion-splash">
          <p class="presented-by splash-text">presented by</p>
          <img :src="BroadcastLogo" alt="League Broadcast" class="splash-logo" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="css" scoped>
.pp-container {
  display: grid;
}

.pp-container > * {
  grid-area: 1 / 1;
}

.pp-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.4s ease-in-out;
}

.pp-leave-active {
  transition: opacity 0.25s ease 0.5s;
}

.pp-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

.pp-leave-to {
  opacity: 0;
}

/* Frame matches the scoreboard top row: 64px tall, same radius, border + background.
   margin-bottom is the inter-card gap when baron + dragon stack (see container). */
.power-play,
.power-play-completion {
  position: relative;
  width: 200px;
  height: 64px;
  margin-bottom: 4px;
  /* Fully opaque on purpose: the completion popup animates in over the
     power-play content, which would shine through a translucent scrim. */
  background-color: black;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 0 14px color-mix(in oklab, var(--broadcast-accent) 35%, transparent);
}

.power-play {
  display: flex;
  flex-direction: row;
}

.pp-body {
  flex: 1;
  min-width: 0;
  margin-left: 32px;
  display: flex;
  flex-direction: column;
}

.power-play.mirror .pp-body {
  margin-left: 0;
  margin-right: 32px;
}

/* --- project brand rail ------------------------------------------------- */

.brand-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 32px;
  background: var(--broadcast-accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 2;
  animation: rail-collapse 0.55s cubic-bezier(0.65, 0, 0.35, 1) 1.5s both;
}

.mirror .brand-rail {
  left: auto;
  right: 0;
}

@keyframes rail-collapse {
  from {
    width: 100%;
  }

  to {
    width: 32px;
  }
}

.brand-rail-logo {
  width: 22px;
  height: 22px;
  animation: rail-logo-shrink 0.55s cubic-bezier(0.65, 0, 0.35, 1) 1.5s both;
}

@keyframes rail-logo-shrink {
  from {
    width: 36px;
    height: 36px;
  }

  to {
    width: 22px;
    height: 22px;
  }
}

.brand-rail.static,
.brand-rail.static .brand-rail-logo {
  animation: none;
}

.presented-by {
  width: 100%;
  text-align: center;
  color: white;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  height: 12px;
  margin-bottom: 8px;
  letter-spacing: 3px;
  text-transform: uppercase;
  white-space: nowrap;
  animation: presented-fade-out 0.25s ease 1.3s both;
}

/* fade out and give the space back so the logo re-centers for the rail collapse */
@keyframes presented-fade-out {
  from {
    opacity: 1;
    height: 12px;
    margin-bottom: 8px;
  }

  to {
    opacity: 0;
    height: 0px;
    margin-bottom: 0px;
  }
}

/* Brand sheen: a narrow accent band sweeps the card once per cycle (after the intro) */
.power-play::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 45%;
  background: linear-gradient(
    100deg,
    transparent,
    color-mix(in oklab, var(--broadcast-accent) 30%, transparent 55%),
    transparent
  );
  /* backwards fill keeps the band parked off-card during the initial delay */
  animation: brand-sheen 9s ease-in-out 2.5s infinite backwards;
  pointer-events: none;
  /* below the brand rail (z-index 2) so the sweep never covers the project branding */
  z-index: 1;
}

@keyframes brand-sheen {
  0% {
    transform: translateX(-110%) skewX(-18deg);
  }

  16% {
    transform: translateX(330%) skewX(-18deg);
  }

  100% {
    transform: translateX(330%) skewX(-18deg);
  }
}

/* --- Active card body ---------------------------------------------------- */

.power-play-text {
  color: white;
  font-weight: 700;
  font-size: 20px;
  line-height: 22px;
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
  width: 100%;
  text-align: center;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--broadcast-accent) 22%, transparent),
    transparent
  );
}

.power-play-content {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  flex-grow: 1;
  color: white;
  font-weight: 700;
  font-size: 16px;
  line-height: 17px;
  padding-left: 12px;
  padding-right: 6px;
}

.power-play-icon {
  width: 28px;
  height: 28px;
  padding: 2px;
  border-radius: var(--radius-md);
}

.power-play-timer {
  width: 100%;
  height: 7px;
  background: transparent;
  overflow: hidden;
  margin-top: auto;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  border-top: 1px solid #ffffff55;
}

.power-play-timer.mirror {
  justify-content: flex-end;
}

.power-play-timer-bar {
  transition: width 1s linear;
  height: 100%;
}

.power-play-timer-bar.elder {
  background: var(--elder-color);
}

.power-play-timer-bar.baron {
  background: var(--baron-color);
}

/* --- Completion card ------------------------------------------------------ */

.completion-body {
  position: absolute;
  inset: 0;
  margin-left: 32px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.power-play-completion.mirror .completion-body {
  margin-left: 0;
  margin-right: 32px;
}

.completion-icon {
  width: 34px;
  height: 34px;
  padding: 3px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.completion-gold {
  font-weight: 800;
  font-size: 28px;
  line-height: 1;
  text-shadow: 0 2px 4px black;
  white-space: nowrap;
}

/* project outro: accent panel wipes in from the branded edge */
.completion-splash {
  position: absolute;
  inset: 0;
  background: var(--broadcast-accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  animation: splash-wipe 0.5s cubic-bezier(0.22, 1, 0.36, 1) 2.4s both;
}

@keyframes splash-wipe {
  from {
    transform: translateX(-104%) skewX(-10deg);
  }

  to {
    transform: translateX(0) skewX(0deg);
  }
}

.mirror .completion-splash {
  animation-name: splash-wipe-mirror;
}

@keyframes splash-wipe-mirror {
  from {
    transform: translateX(104%) skewX(10deg);
  }

  to {
    transform: translateX(0) skewX(0deg);
  }
}

.splash-logo {
  width: 36px;
  height: 36px;
  animation: splash-logo-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 2.7s both;
}

/* outro text keeps its layout space and only fades in */
.presented-by.splash-text {
  animation: presented-fade-in 0.3s ease 2.85s both;
}

@keyframes splash-logo-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes presented-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
