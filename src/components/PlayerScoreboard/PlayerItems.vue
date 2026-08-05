<script setup lang="ts">
import { useClient } from '@/client'
import {
  getRoleQuest,
  getSortedInventory,
  getTrinket,
  ingameScoreboardBottomData,
  ingameScoreboardBottomPlayerData,
  isPlayerDead,
  tabPlayer,
  type itemWithAsset,
  type perkInfoV2,
} from '@bluebottle_gg/league-broadcast-client'
import { computed } from 'vue'
import ItemWithCooldown from './ItemWithCooldown.vue'
import RoleQuestSlot from './RoleQuestSlot.vue'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { useGameClock } from '@/composables/useGameClock'

const props = defineProps<{
  scoreboardPlayer?: ingameScoreboardBottomPlayerData
  tabPlayer?: tabPlayer
  mirror?: boolean
}>()

const client = useClient()
const gameTime = useGameClock()

// Derived here rather than passed down, so the scoreboard root does not have to read the
// clock — and rebuild every player's vnodes — on every animation frame.
const grayscale = computed(() => isPlayerDead(props.scoreboardPlayer, gameTime.value))

const roleQuest = computed(() => {
  if (!props.scoreboardPlayer) return undefined
  return getRoleQuest(props.scoreboardPlayer)
})

const trinket = computed(() => {
  if (!props.scoreboardPlayer) return undefined
  return getTrinket(props.scoreboardPlayer)
})

const sortedInventory = computed(() => {
  if (!props.scoreboardPlayer) return []
  return getSortedInventory(props.scoreboardPlayer)
})

const primaryRuneTree = computed(() => {
  return props.tabPlayer?.perks[0]
})
</script>

<template>
  <div
    class="flex h-full items-center gap-1 justify-center"
    :class="mirror ? 'flex-row' : 'flex-row-reverse'"
    :style="{ filter: grayscale ? 'grayscale(1)' : 'grayscale(0)', transition: 'filter 0.5s ease' }"
  >
    <div class="flex flex-col h-full w-4 justify-center items-center gap-1">
      <img
        class="w-full"
        :src="client.getCacheUrl(primaryRuneTree?.iconPath)"
        @error="handleImageError"
        @load="handleImageLoad"
      />
      <RoleQuestSlot
        :item="roleQuest"
        :mirror="mirror"
        :class="'w-4 h-4'"
        :progress-color="mirror ? 'var(--red-team-color)' : 'var(--blue-team-color)'"
      />
    </div>
    <div
      class="flex h-full items-center gap-2 justify-center"
      :class="mirror ? 'flex-row' : 'flex-row-reverse'"
    >
      <div
        class="flex h-full items-center justify-center gap-0.5"
        :class="mirror ? 'flex-row-reverse' : 'flex-row'"
      >
        <ItemWithCooldown
          class="w-6 h-6"
          v-for="(item, index) in sortedInventory"
          :key="index"
          :item="item"
        />
      </div>
      <ItemWithCooldown
        class="w-6 h-6"
        :item="trinket"
        :vision-score="scoreboardPlayer?.visionScore"
      />
    </div>
  </div>
</template>

<style lang="css" scoped></style>
