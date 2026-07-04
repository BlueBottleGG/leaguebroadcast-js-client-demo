<script setup lang="ts">
import { BestOfType } from '@bluebottle_gg/league-broadcast-client'

const props = defineProps<{
  bestOf: BestOfType
  wins: number
  fillColor: string
  mirror?: boolean
}>()
</script>

<template>
  <div class="flex gap-1" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
    <div id="color-display" class="flex w-2 border border-white/55 rounded-xs p-px">
      <div
        class="grow"
        :style="{
          backgroundColor: fillColor,
        }"
      ></div>
    </div>

    <div id="scores" class="w-2 flex flex-col gap-1.5" v-if="bestOf !== BestOfType.BestOf1">
      <div
        class="flex flex-1 w-full grow border border-white/55 rounded-xs p-px"
        v-for="i in bestOf"
        :key="i"
      >
        <div
          class="grow"
          :style="{
            backgroundColor: i <= wins ? fillColor : 'transparent',
          }"
        ></div>
      </div>
    </div>
    <div v-else class="w-2"></div>
  </div>
</template>

<style lang="css" scoped></style>
