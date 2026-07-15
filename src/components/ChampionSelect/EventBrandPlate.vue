<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { champSelectStateData } from '@bluebottle_gg/league-broadcast-client'
import FadeTransition from '@/transitions/FadeTransition.vue'
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import blueBottleLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'

const props = defineProps<{
  metaData?: champSelectStateData['metaData']
}>()

const shortPatch = computed(
  () => props.metaData?.patch?.trim().split('.').slice(0, 2).join('.') || null,
)
const matchName = computed(() => props.metaData?.matchData?.name?.trim() || null)
const infoItems = computed(() => [
  ...(matchName.value ? [matchName.value] : []),
  'LEAGUE BROADCAST',
  ...(shortPatch.value ? [`PATCH ${shortPatch.value}`] : []),
])

const tick = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => tick.value++, 10000)
})
onUnmounted(() => clearInterval(timer))

const infoIndex = computed(() => tick.value % Math.max(1, infoItems.value.length))
const currentInfo = computed(() => infoItems.value[infoIndex.value] ?? '')
const projectLogos = [blueBottleLogo, leagueBroadcastLogo]
const logoIndex = computed(() => tick.value % projectLogos.length)
</script>

<template>
  <div class="brand-plate">
    <img class="league-logo" :src="leagueBroadcastLogo" alt="League Broadcast" />
    <span class="rule" />
    <div class="info-slot">
      <FadeTransition mode="out-in">
        <span :key="infoIndex" class="info-text">{{ currentInfo }}</span>
      </FadeTransition>
    </div>
    <span class="rule" />
    <div class="project-slot">
      <FadeTransition mode="out-in">
        <img :key="logoIndex" class="project-logo" :src="projectLogos[logoIndex]" alt="" />
      </FadeTransition>
    </div>
  </div>
</template>

<style scoped>
.brand-plate {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 52px;
  padding: 0 26px;
  background: linear-gradient(to top, rgb(0 0 0 / 0.94), rgb(0 0 0 / 0.82));
  border-top: 2px solid var(--broadcast-accent);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 -6px 14px rgb(0 0 0 / 0.5);
}

.league-logo {
  width: 152px;
  height: 26px;
  object-fit: contain;
}

.rule {
  width: 1px;
  height: 18px;
  background: rgb(255 255 255 / 0.25);
}

.info-slot {
  display: grid;
  place-items: center;
  min-width: 240px;
  max-width: 460px;
  overflow: hidden;
}

.info-text {
  grid-area: 1 / 1;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  white-space: nowrap;
}

.project-slot {
  display: grid;
  place-items: center;
  width: 60px;
  height: 52px;
}

.project-logo {
  grid-area: 1 / 1;
  width: 60px;
  height: 30px;
  object-fit: contain;
}
</style>
