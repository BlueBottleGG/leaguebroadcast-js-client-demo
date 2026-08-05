<script setup lang="ts">
import {
  ResourceType,
  SpellSlotIndex,
  tabsStyle,
  type ingameScoreboardBottomPlayerData,
  type tabPlayer,
  getRespawnRemaining,
  isPlayerDead,
} from '@bluebottle_gg/league-broadcast-client'
import { computed } from 'vue'
import SpellWithCooldown from './SpellWithCooldown.vue'
import { useClient } from '@/client'
import { playerDisplayName } from '@/utils/playerDisplayName'
import ProgressBar from './ProgressBar.vue'
import LevelUpNotification from './LevelUpNotification.vue'
import { useGameClock } from '@/composables/useGameClock'

const props = defineProps<{
  scoreboardPlayer?: ingameScoreboardBottomPlayerData
  tabPlayer?: tabPlayer
  mirror?: boolean
  levelUpLevel?: number | null
  levelUpVisible?: boolean
  levelUpExiting?: boolean
}>()

const client = useClient()
const gameTime = useGameClock()

const shutdown = computed(() => {
  if (!props.scoreboardPlayer) return undefined
  if (props.scoreboardPlayer.shutdown < 300) {
    return ''
  }

  return props.scoreboardPlayer.shutdown.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 0,
  })
})

const respawnTimeRemaining = computed(() => {
  if (!props.scoreboardPlayer) return undefined
  const remaining = getRespawnRemaining(props.scoreboardPlayer, gameTime.value)
  return remaining > 0 ? Math.ceil(remaining) : undefined
})

const ultimate = computed(() => {
  if (!props.scoreboardPlayer) return undefined
  return props.tabPlayer?.abilities[SpellSlotIndex.R]
})
const summonerOne = computed(() => {
  if (!props.tabPlayer) return undefined
  return props.tabPlayer.abilities[SpellSlotIndex.D]
})

const summonerTwo = computed(() => {
  if (!props.tabPlayer) return undefined
  return props.tabPlayer.abilities[SpellSlotIndex.F]
})

// Champion alias is the last resort, so the name plate never renders empty for a
// player the backend gave neither an overlay name nor a Riot ID.
const playerNameNoTag = computed(() =>
  playerDisplayName(props.scoreboardPlayer, props.scoreboardPlayer?.champion?.alias ?? ''),
)

const isDead = computed(() => isPlayerDead(props.scoreboardPlayer, gameTime.value))

const buffBorderClass = computed(() => {
  const hasBaron = props.tabPlayer?.hasBaron ?? false
  const hasElder = props.tabPlayer?.hasElder ?? false
  if (hasBaron && hasElder) return 'buff-both'
  if (hasBaron) return 'buff-baron'
  if (hasElder) return 'buff-elder'
  return ''
})

const xpProgress = computed(() => {
  if (!props.tabPlayer) return 0
  const previousLevel = props.tabPlayer.experience.previousLevel
  const nextLevel = props.tabPlayer.experience.nextLevel
  const current = props.tabPlayer.experience.current
  return ((current - previousLevel) / (nextLevel - previousLevel)) * 100
})

const resourceColor = computed(() => {
  //resource type might be a string, so parse it to enum if needed
  const resourceType =
    typeof props.tabPlayer?.resource.type === 'string'
      ? ResourceType[props.tabPlayer.resource.type as keyof typeof ResourceType]
      : props.tabPlayer?.resource.type

  switch (resourceType) {
    case ResourceType.mana:
      return '#1d4ed8'
    case ResourceType.energy:
      return '#d6db29'
    case ResourceType.none:
      return 'transparent'
    case ResourceType.shield:
      return '#A9A9A9'
    case ResourceType.battlefury:
    case ResourceType.dragonfury:
    case ResourceType.rage:
    case ResourceType.heat:
    case ResourceType.gnarfury:
    case ResourceType.ferocity:
    case ResourceType.bloodwell:
      return '#bf0000'
    case ResourceType.wind:
      return '#A9A9A9'
    case ResourceType.unknown:
    default:
      return '#1d4ed8'
  }
})
</script>

<template>
  <div id="player-info-container" :class="{ mirror, 'is-dead': isDead }">
    <div class="relative overflow-hidden">
      <div class="absolute inset-0 flex flex-col items-center justify-around gap-0.5">
        <SpellWithCooldown
          class="w-full aspect-square flex-1 min-h-0 max-h-[50%]"
          :ready-at="summonerOne?.readyAt"
          :total-cooldown="summonerOne?.totalCooldown"
          :img="client.getCacheUrl(summonerOne?.assets?.iconAsset)"
          show-timer
          skilled
          :is-toggled="summonerOne?.isToggled"
        />
        <SpellWithCooldown
          class="w-full aspect-square flex-1 min-h-0 max-h-[50%]"
          :ready-at="summonerTwo?.readyAt"
          :total-cooldown="summonerTwo?.totalCooldown"
          :img="client.getCacheUrl(summonerTwo?.assets?.iconAsset)"
          show-timer
          skilled
          :is-toggled="summonerTwo?.isToggled"
        />
      </div>
    </div>
    <div class="relative w-full h-full p-0.5 overflow-hidden" :class="buffBorderClass">
      <img
        id="player-champion-icon"
        :src="client.getCacheUrl(scoreboardPlayer?.champion?.squareImg)"
      />
      <span class="shutdown-text"> {{ shutdown }}</span>
      <span
        class="level-text"
        :style="{
          fontSize: '16px',
          textAlign: mirror ? 'left' : 'right',
          right: mirror ? 'auto' : '0',
          left: mirror ? '0' : 'auto',
          color: isDead ? '#E2B793' : 'white',
        }"
      >
        {{ scoreboardPlayer?.level }}</span
      >
      <span
        v-if="tabPlayer?.stacksData"
        class="level-text stacks-text"
        :style="{
          fontSize: '12px',
          textAlign: mirror ? 'right' : 'left',
          right: mirror ? '0' : 'auto',
          left: mirror ? 'auto' : '0',
          color: isDead ? '#E2B793' : 'white',
        }"
      >
        {{ Math.round(tabPlayer.stacksData) }}</span
      >
      <div
        v-if="isDead"
        class="absolute flex top-0 left-0 h-full w-full justify-center items-center text-center"
      >
        <p class="death-timer-text">{{ respawnTimeRemaining }}</p>
      </div>
      <LevelUpNotification
        :level="levelUpLevel ?? undefined"
        :visible="levelUpVisible ?? false"
        :exiting="levelUpExiting ?? false"
        :mirror="mirror"
      />
    </div>
    <div class="flex flex-col">
      <div
        class="relative flex justify-start items-center"
        :class="mirror ? 'flex-row-reverse' : 'flex-row'"
      >
        <SpellWithCooldown
          class="h-6 w-6 shrink-0 rounded-full aspect-square border border-white"
          style="background: radial-gradient(circle at center, transparent, rgba(0, 0, 0, 0.7) 70%)"
          :ready-at="ultimate?.readyAt"
          :total-cooldown="ultimate?.totalCooldown"
          :img="client.getCacheUrl(ultimate?.assets?.iconAsset)"
          show-timer
          :skilled="(ultimate?.level ?? 0) > 0"
          :is-toggled="ultimate?.isToggled"
        />
        <span
          class="player-name-text"
          :style="{
            textAlign: mirror ? 'right' : 'left',
          }"
        >
          {{ playerNameNoTag }}</span
        >
      </div>

      <div class="health-grid" :class="mirror ? 'ml-auto' : ''">
        <!-- XP Bar-->
        <ProgressBar
          class="w-full"
          :fill-color="'purple'"
          :mirror="mirror"
          :progress-pct="xpProgress"
        />
        <!-- Health Bar-->
        <ProgressBar
          class="w-full"
          :fill-color="'green'"
          :mirror="mirror"
          :progress-pct="((tabPlayer?.health.current ?? 0) / (tabPlayer?.health.max ?? 1)) * 100"
        />
        <!-- Mana Bar-->
        <ProgressBar
          class="w-full"
          :fill-color="resourceColor"
          :mirror="mirror"
          :progress-pct="
            ((tabPlayer?.resource.current ?? 0) / (tabPlayer?.resource.max ?? 1)) * 100
          "
        />
      </div>
    </div>

    <div class="player-stats" :class="mirror ? 'text-start' : 'text-end'">
      <span class="absolute text-[#E2B793] w-full -translate-y-2">{{
        scoreboardPlayer?.creepScore
      }}</span>
      <span class="absolute w-full translate-y-2"
        >{{ scoreboardPlayer?.kills }}/{{ scoreboardPlayer?.deaths }}/{{
          scoreboardPlayer?.assists
        }}</span
      >
    </div>
  </div>
</template>

<style lang="css" scoped>
* {
  font-size: 16px;
}

#player-info-container {
  display: grid;
  grid-template-columns: 24px 1fr 3fr 1fr;
  grid-template-rows: minmax(0, 1fr);
  gap: 0px;
  padding: 4px;
  border-inline-start: var(--brand-border-width) solid var(--border-color);
  overflow: hidden;
}

#player-info-container.mirror {
  direction: rtl;
}

#player-info-container.mirror > * {
  direction: ltr;
}

#player-info-container span {
  width: 100%;
  font-weight: 800;
}

.level-text {
  position: absolute;
  bottom: -5px;
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
  z-index: 10;
}

.stacks-text {
  text-shadow:
    0 1px 1px rgba(0, 0, 0, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.65);
}

.shutdown-text {
  position: absolute;
  top: 0px;
  width: 100%;
  text-align: center;
  color: #e2b793;
  /* Add a prominent text border for better visibility since champion icons can be bright, dark, etc. */
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
}

.death-timer-text {
  color: white;
  font-size: 24px;
  font-weight: 800;
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
}

.player-name-text {
  color: white;
  font-size: 14px;
  letter-spacing: var(--tracking-wide);
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
  margin-left: 4px;
  margin-right: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

.health-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 2fr 2fr;
  gap: 2px;
  width: 80%;
  height: 100%;
  padding-top: 2px;
  padding-left: 4px;
  padding-right: 4px;
}

.player-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: white;
  font-weight: 800;
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
  position: relative;
}

/* Grayscale all columns except the death timer when player is dead */
#player-info-container > div:first-child,
#player-info-container > div:nth-child(3),
#player-info-container > .player-stats {
  filter: grayscale(0);
  transition: filter 0.5s ease;
}

#player-info-container.is-dead > div:first-child,
#player-info-container.is-dead > div:nth-child(3),
#player-info-container.is-dead > .player-stats {
  filter: grayscale(1);
}

/* In the champion icon cell, gray specific elements but not the death timer overlay */
#player-info-container #player-champion-icon,
#player-info-container .shutdown-text,
#player-info-container .level-text {
  filter: grayscale(0);
  transition: filter 0.5s ease;
}

#player-info-container.is-dead #player-champion-icon,
#player-info-container.is-dead .shutdown-text,
#player-info-container.is-dead .level-text {
  filter: grayscale(1);
}

.buff-baron::before,
.buff-elder::before,
.buff-both::before {
  content: '';
  position: absolute;
  inset: 2px;
  pointer-events: none;
  z-index: 1;
}

.buff-baron::before {
  border: 3px solid var(--baron-color);
  animation: baron-pulse 3s ease-in-out infinite;
}

.buff-elder::before {
  border: 3px solid var(--elder-color);
  animation: elder-pulse 3s ease-in-out infinite;
}

.buff-both::before {
  inset: 0;
  background: conic-gradient(
    from var(--swirl-angle),
    var(--baron-color),
    var(--elder-color),
    var(--baron-color),
    var(--elder-color),
    var(--baron-color)
  );
  animation: swirl 6s linear infinite;
  mask:
    linear-gradient(
      to bottom,
      #000 3px,
      transparent 0,
      transparent calc(100% - 3px),
      #000 calc(100% - 3px)
    ),
    linear-gradient(
      to right,
      #000 3px,
      transparent 0,
      transparent calc(100% - 3px),
      #000 calc(100% - 3px)
    );
  mask-composite: add;
  -webkit-mask:
    linear-gradient(
      to bottom,
      #000 3px,
      transparent 0,
      transparent calc(100% - 3px),
      #000 calc(100% - 3px)
    ),
    linear-gradient(
      to right,
      #000 3px,
      transparent 0,
      transparent calc(100% - 3px),
      #000 calc(100% - 3px)
    );
  -webkit-mask-composite: source-over;
}

@property --swirl-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes baron-pulse {
  0%,
  100% {
    border-color: oklch(from var(--baron-color) l c h / 0.3);
  }

  50% {
    border-color: oklch(from var(--baron-color) l c h / 1);
  }
}

@keyframes elder-pulse {
  0%,
  100% {
    border-color: oklch(from var(--elder-color) l c h / 0.3);
  }

  50% {
    border-color: oklch(from var(--elder-color) l c h / 1);
  }
}

@keyframes swirl {
  to {
    --swirl-angle: 360deg;
  }
}
</style>
