<script setup lang="ts">
import {
  IngameObjectiveType,
  getRemaining,
  type iObjectiveRespawnData,
} from '@bluebottle_gg/league-broadcast-client'
import { computed } from 'vue'
import Baron from '@/assets/baron/baron.png'
import Herald from '@/assets/baron/herald.png'
import Grub from '@/assets/baron/grubs.png'
import AirDragon from '@/assets/dragon/air.png'
import ChemtechDragon from '@/assets/dragon/chemtech.png'
import HextechDragon from '@/assets/dragon/hextech.png'
import EarthDragon from '@/assets/dragon/earth.png'
import FireDragon from '@/assets/dragon/fire.png'
import WaterDragon from '@/assets/dragon/water.png'
import ElderDragon from '@/assets/dragon/elder.png'
import FadeTransition from '../../transitions/FadeTransition.vue'
import { useGameClock } from '@/composables/useGameClock'

const props = withDefaults(
  defineProps<{
    objectiveData?: iObjectiveRespawnData
  }>(),
  {
    objectiveData: undefined,
  },
)

const gameTime = useGameClock()

const objectiveType = computed(() => {
  if (!props.objectiveData) return undefined
  //parse type to enum, it might be a string or a number, so we have to handle both cases.
  return typeof props.objectiveData.type === 'string'
    ? IngameObjectiveType[props.objectiveData.type as keyof typeof IngameObjectiveType]
    : props.objectiveData.type
})

const respawnTimeRemaining = computed(() => {
  if (!props.objectiveData || props.objectiveData.timeAlive === undefined) return undefined
  const time = getRemaining(props.objectiveData.timeAlive, gameTime.value)
  return time > 0 ? time : 0
})

// Quantized so the template never reads the continuously-advancing remaining time directly.
const textWidth = computed(() =>
  respawnTimeRemaining.value !== undefined && respawnTimeRemaining.value > 0 ? '5rem' : '0px',
)
const formattedRespawnTime = computed(() => {
  if (respawnTimeRemaining.value === undefined) return ''
  const time = respawnTimeRemaining.value
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const backgroundColor = computed(() => {
  if (!props.objectiveData) return '#36215C'
  const type = objectiveType.value
  switch (type) {
    case IngameObjectiveType.BARON:
    case IngameObjectiveType.HERALD:
    case IngameObjectiveType.GRUB:
      return '#36215C'
    case IngameObjectiveType.DRAGON_AIR:
      return '#2D485D'
    case IngameObjectiveType.DRAGON_CHEMTECH:
      return '#4A631A'
    case IngameObjectiveType.DRAGON_HEXTECH:
      return '#1E4754'
    case IngameObjectiveType.DRAGON_EARTH:
      return '#4A631A'
    case IngameObjectiveType.DRAGON_FIRE:
      return '#2D485D'
    case IngameObjectiveType.DRAGON_WATER:
      return '#2A514A'
    case IngameObjectiveType.DRAGON_ELDER:
      return '#B7C9E2'
    default:
      return '#B7C9E2'
  }
})

const objectiveIcon = computed(() => {
  if (!props.objectiveData) return Baron
  //parse type to enum, it might be a string or a number, so we have to handle both cases.
  const type = objectiveType.value
  switch (type) {
    case IngameObjectiveType.BARON:
      return Baron
    case IngameObjectiveType.HERALD:
      return Herald
    case IngameObjectiveType.GRUB:
      return Grub
    case IngameObjectiveType.DRAGON_AIR:
      return AirDragon
    case IngameObjectiveType.DRAGON_CHEMTECH:
      return ChemtechDragon
    case IngameObjectiveType.DRAGON_HEXTECH:
      return HextechDragon
    case IngameObjectiveType.DRAGON_EARTH:
      return EarthDragon
    case IngameObjectiveType.DRAGON_FIRE:
      return FireDragon
    case IngameObjectiveType.DRAGON_WATER:
      return WaterDragon
    case IngameObjectiveType.DRAGON_ELDER:
      return ElderDragon
    default:
      return Baron
  }
})
</script>

<template>
  <FadeTransition>
    <div v-if="objectiveType !== undefined" class="respawn-timer-container">
      <div
        class="respawn-timer-icon-container"
        :style="{
          backgroundColor: backgroundColor,
        }"
      >
        <img :src="objectiveIcon" alt="Objective Icon" />
      </div>

      <div
        class="respawn-timer-text-container"
        :style="{ width: textWidth }"
      >
        <p class="respawn-timer-text">
          {{ formattedRespawnTime }}
        </p>
      </div>
    </div>
  </FadeTransition>
</template>

<style lang="css" scoped>
.respawn-timer-container {
  height: 40px;
  border: var(--brand-border-width) solid var(--border-color);
  box-shadow: 0 0 10px color-mix(in oklab, var(--broadcast-accent) 25%, transparent);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  padding: 4px;
  background-color: var(--surface-soft);
}

.respawn-timer-icon-container {
  padding: 4px;
  width: 32px;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.respawn-timer-icon-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.respawn-timer-text-container {
  overflow: hidden;
  transition: width 0.3s ease-in-out;
}

.respawn-timer-text {
  font-size: 24px;
  font-weight: 700;
  padding-left: 10px;
  padding-right: 6px;
  white-space: nowrap;
}
</style>
