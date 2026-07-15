<script setup lang="ts">
import { BestOfType, ingameScoreboardTeamData } from '@bluebottle_gg/league-broadcast-client'
import MatchScore from './MatchScore.vue'
import { useClient } from '@/client'
import TextWithIcon from './TextWithIcon.vue'
import Gold from '@/assets/gold.png'
import Tower from '@/assets/tower.png'
import { computed, ref, watch } from 'vue'
import FadeTransition from '../../transitions/FadeTransition.vue'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'

const props = defineProps<{
  team: ingameScoreboardTeamData
  bestOf: BestOfType
  mirror?: boolean
  enemyTeamGold?: number
}>()

const client = useClient()

const teamColor = computed(() =>
  props.mirror ? 'var(--red-team-color)' : 'var(--blue-team-color)',
)

const formattedGold = computed(() => {
  const gold = props.team.gold
  if (gold >= 1000) {
    return (gold / 1000).toFixed(1) + 'K'
  }
  return gold.toFixed(0)
})

const goldDiff = computed(() => {
  if (props.enemyTeamGold === undefined) return null
  const diff = props.team.gold - props.enemyTeamGold
  return Math.floor(diff)
})

const goldDiffText = computed(() => {
  const diff = goldDiff.value
  if (diff === null || diff <= 0) return ''
  const formattedDiff = diff >= 1000 ? (diff / 1000).toFixed(1) + 'K' : diff.toString()
  return '+' + formattedDiff
})

// Hysteresis: show above 500, hide below 300 - prevent flickering
const SHOW_THRESHOLD = 500
const HIDE_THRESHOLD = 300
const showGoldDiff = ref(false)

watch(
  goldDiff,
  (diff) => {
    if (diff === null || diff <= 0) {
      showGoldDiff.value = false
    } else if (diff > SHOW_THRESHOLD) {
      showGoldDiff.value = true
    } else if (diff < HIDE_THRESHOLD) {
      showGoldDiff.value = false
    }
    // Between HIDE_THRESHOLD and SHOW_THRESHOLD: keep current state
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="w-full h-full flex items-center gap-2 py-1"
    :class="mirror ? 'flex-row-reverse pr-1 pl-2' : 'flex-row pl-1 pr-2'"
  >
    <MatchScore
      class="self-stretch shrink-0"
      :best-of="bestOf"
      :fill-color="teamColor"
      :wins="team.seriesScore.wins"
      :mirror="mirror"
    />
    <div v-if="team.teamIconUrl" class="w-12 h-full shrink-0 flex items-center justify-center">
      <img
        :src="client.getCacheUrl(team.teamIconUrl)"
        alt="Team icon"
        class="max-w-full max-h-full object-contain"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </div>
    <div
      class="flex flex-col justify-center flex-1 min-w-0"
      :class="mirror ? 'text-right' : 'text-left'"
    >
      <p
        class="font-extrabold text-2xl leading-6 overflow-hidden whitespace-nowrap text-ellipsis"
        :style="{ color: teamColor }"
      >
        {{ team.teamTag }}
      </p>
      <p class="font-medium text-sm leading-4 overflow-hidden whitespace-nowrap text-ellipsis">
        {{ team.infoText }}
      </p>
    </div>
    <TextWithIcon
      class="shrink-0"
      :icon-url="Tower"
      :text="team.towers.toString()"
      :mirror="mirror"
      text-width="1.5ch"
    />
    <div class="relative shrink-0">
      <TextWithIcon :icon-url="Gold" :text="formattedGold" :mirror="mirror" text-width="4.5ch" />
      <FadeTransition name="fade" mode="out-in">
        <div
          id="gold-diff"
          v-if="showGoldDiff"
          class="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 w-12 h-4 flex items-center justify-center rounded-xs"
          :style="{ backgroundColor: teamColor }"
        >
          <span class="text-white text-base font-bold">{{ goldDiffText }}</span>
        </div>
      </FadeTransition>
    </div>
    <span class="shrink-0 min-w-[2ch] text-center text-4xl font-black">{{ team.kills }}</span>
  </div>
</template>
