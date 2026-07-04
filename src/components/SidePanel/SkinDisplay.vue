<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import type { ingameSkinDisplayPlayerData, Team } from '@bluebottle_gg/league-broadcast-client'
import { computed, ref, watch, onUnmounted } from 'vue'

import TopIcon from '@/assets/lane/top-placeholder-cropped.svg?url'
import JungleIcon from '@/assets/lane/jgl-placeholder-cropped.svg?url'
import MidIcon from '@/assets/lane/mid-placeholder-cropped.svg?url'
import ADCIcon from '@/assets/lane/bot-placeholder-cropped.svg?url'
import SupportIcon from '@/assets/lane/sup-placeholder-cropped.svg?url'

import LeagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import { useClient } from '@/client'

const props = defineProps<{
  mirror?: boolean
  team: Team
}>()

const skinData = useIngameSelector((s) => s.gameData.skinDisplay)
const client = useClient()

const teamData = computed(() => {
  if (!skinData.value?.teams) return null
  return skinData.value.teams[props.team - 1] // team is 1-based index, since team 0 is "none"
})

const currentPlayerIndex = ref(0)
let rotationInterval: ReturnType<typeof setInterval> | null = null

const currentPlayer = computed<ingameSkinDisplayPlayerData | undefined>(() => {
  if (!teamData.value?.players?.length) return undefined
  return teamData.value.players[currentPlayerIndex.value % teamData.value.players.length]
})

const playerCount = computed(() => teamData.value?.players?.length ?? 0)

function startRotation() {
  stopRotation()
  rotationInterval = setInterval(() => {
    if (playerCount.value > 0) {
      currentPlayerIndex.value = (currentPlayerIndex.value + 1) % playerCount.value
    }
  }, 3500)
}

function stopRotation() {
  if (rotationInterval) {
    clearInterval(rotationInterval)
    rotationInterval = null
  }
}

watch(
  () => !!skinData.value,
  (isActive) => {
    if (isActive) {
      currentPlayerIndex.value = 0
      startRotation()
    } else {
      stopRotation()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  stopRotation()
})

function getRoleIcon(index: number): string {
  switch (index) {
    case 0:
      return TopIcon
    case 1:
      return JungleIcon
    case 2:
      return MidIcon
    case 3:
      return ADCIcon
    case 4:
      return SupportIcon
    default:
      return ''
  }
}

function getRoleStyle(index: number) {
  const baseSize = 64
  const largerScale = 1.25
  if (index === 4 || index === 1) {
    return {
      width: `${baseSize * largerScale}px`,
      height: `${baseSize * largerScale}px`,
    }
  }
  return {
    width: `${baseSize}px`,
    height: `${baseSize}px`,
  }
}
</script>

<template>
  <Transition :name="mirror ? 'skin-slide-right' : 'skin-slide-left'">
    <div v-if="teamData" class="skin-container" :class="{ mirror: mirror }">
      <div class="skin-panel" :class="{ mirror: mirror }">
        <transition :name="mirror ? 'slide-mirror' : 'slide'">
          <div v-if="currentPlayer" :key="currentPlayerIndex" class="skin-panel-content">
            <!-- Skin splash image -->
            <img
              :src="client.getCacheUrl(currentPlayer.splashCenteredUrl || currentPlayer.splashUrl)"
              :alt="currentPlayer.skinName"
              class="skin-splash"
              :class="{ 'mirror-img': mirror }"
            />

            <!-- Gradient overlay -->
            <div class="skin-overlay" :class="{ mirror: mirror }" />

            <div class="lane-info">
              <img
                :src="getRoleIcon(currentPlayerIndex)"
                alt="Role Icon"
                style="filter: invert()"
                :style="getRoleStyle(currentPlayerIndex)"
                v-if="currentPlayerIndex !== undefined"
              />
            </div>
            <!-- Player info -->
            <div class="skin-info" :class="{ mirror: mirror }">
              <p class="player-name">{{ currentPlayer.playerName }}</p>
              <p class="skin-name">{{ currentPlayer.skinName }}</p>
            </div>
          </div>
        </transition>
      </div>
      <div class="powered-by-panel">
        <img :src="LeagueBroadcastLogo" alt="League Broadcast Logo" class="h-6 object-contain" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.skin-container {
  width: 260px;
  position: absolute;
  top: 40%;
  left: 0;
  transform: translateY(-50%);
  background-color: black;
}

.skin-container.mirror {
  left: auto;
  right: 0;
}

/* Panel enter/exit transitions */
.skin-slide-left-enter-active,
.skin-slide-left-leave-active,
.skin-slide-right-enter-active,
.skin-slide-right-leave-active {
  transition: transform 0.3s ease-out;
}

.skin-slide-left-enter-from,
.skin-slide-left-leave-to {
  transform: translateX(-110%) translateY(-50%);
}

.skin-slide-right-enter-from,
.skin-slide-right-leave-to {
  transform: translateX(110%) translateY(-50%);
}

.skin-panel {
  position: relative;
  overflow: hidden;
  height: 550px;
  background: transparent;
}

.powered-by-panel {
  background: black;
  width: 100%;
  padding: 0px;
  height: 40px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.powered-by-panel img {
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
}

.skin-panel-content {
  position: relative;
  width: 100%;
  height: 100%;
}

.skin-splash {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
}

.mirror-img {
  transform: scaleX(-1);
}

.skin-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, transparent 40%, rgba(0, 0, 0, 0.85) 100%);
}

.skin-overlay.mirror {
  background: linear-gradient(to left, transparent 40%, rgba(0, 0, 0, 0.85) 100%);
}

.skin-info {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 2;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.lane-info {
  position: absolute;
  bottom: 120px;
  z-index: 2;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
  width: 100%;
  display: flex;
  justify-content: center;
}

.skin-info.mirror {
  left: auto;
  right: 12px;
  text-align: right;
}

.player-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.skin-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  margin: 0;
  margin-top: 2px;
}

.page-indicators {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%) translateY(100%);
  display: flex;
  gap: 4px;
  z-index: 2;
}

/* Slide transition for player swaps */
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
  position: absolute;
  inset: 0;
}

.slide-enter-from {
  transform: translateX(calc(100% + 40px));
  opacity: 1;
}

.slide-leave-to {
  transform: translateX(calc(-100% - 40px));
  opacity: 1;
}

/* Mirrored slide transition */
.slide-mirror-enter-active,
.slide-mirror-leave-active {
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
  position: absolute;
  inset: 0;
}

.slide-mirror-enter-from {
  transform: translateX(calc(-100% - 40px));
  opacity: 1;
}

.slide-mirror-leave-to {
  transform: translateX(calc(100% + 40px));
  opacity: 1;
}
</style>
