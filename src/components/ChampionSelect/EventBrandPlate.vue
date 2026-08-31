<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { champSelectStateData } from '@bluebottle_gg/league-broadcast-client'
import FadeTransition from '@/transitions/FadeTransition.vue'
import { CHAMPION_SELECT_PARTNER_LOGOS } from './championSelectBranding'
import { CHAMPION_SELECT_TIMING } from './championSelectTiming'

const props = defineProps<{
  // fed from the scene's frozen snapshot so the plate stays stable during the
  // leave transition (the live store empties the moment champ select ends)
  metaData?: champSelectStateData['metaData']
  eventLogoUrl?: string | null
  eventName?: string | null
}>()

const patch = computed(() => props.metaData?.patch?.trim() || null)
const shortPatch = computed(() => patch.value?.split('.').slice(0, 2).join('.') || null)
const matchName = computed(() => props.metaData?.matchData?.name?.trim() || null)
const eventName = computed(() => props.eventName?.trim() || null)
const eventLogoFailed = ref(false)
watch(
  () => props.eventLogoUrl,
  () => {
    eventLogoFailed.value = false
  },
)

// Draft isn't played on live servers, so the patch is broadcast-relevant info;
// it rotates with the match name and the event name in the center slot.
const infoItems = computed(() => [
  ...(matchName.value ? [matchName.value] : []),
  ...(eventName.value ? [eventName.value] : []),
  ...(shortPatch.value ? [`PATCH ${shortPatch.value}`] : []),
])

// Default project marks take turns in the rotating slot. The current event
// identity remains backend-driven and has its own placement.
const tick = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    tick.value++
  }, CHAMPION_SELECT_TIMING.brandRotationMs)
})
onUnmounted(() => clearInterval(timer))

const infoIndex = computed(() => tick.value % Math.max(1, infoItems.value.length))
const currentInfo = computed(() => infoItems.value[infoIndex.value] ?? '')
const logoIndex = computed(() => tick.value % CHAMPION_SELECT_PARTNER_LOGOS.length)
const currentPartnerLogo = computed(() => CHAMPION_SELECT_PARTNER_LOGOS[logoIndex.value])
</script>

<template>
  <div class="brand-plate">
    <div class="event-identity">
      <img
        v-if="props.eventLogoUrl && !eventLogoFailed"
        class="event-logo"
        :src="props.eventLogoUrl"
        :alt="eventName ? `${eventName} logo` : 'Event logo'"
        @error="eventLogoFailed = true"
      />
      <span v-else class="event-name">{{ eventName || 'EVENT' }}</span>
    </div>

    <span class="rule" />

    <div class="info-slot">
      <FadeTransition mode="out-in">
        <span :key="infoIndex" class="info-text">{{ currentInfo }}</span>
      </FadeTransition>
    </div>

    <span class="rule" />

    <div class="partner-slot">
      <FadeTransition mode="out-in">
        <img
          v-if="currentPartnerLogo"
          :key="logoIndex"
          class="partner-logo"
          :src="currentPartnerLogo.source"
          :alt="currentPartnerLogo.alt"
        />
      </FadeTransition>
    </div>
  </div>
</template>

<style scoped>
/* Centered tab standing on the phase timer bar, rounded only on its free top
   corners. The project accent stays on the top edge, away from team-state color. */
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

/* explicit heights everywhere — the marks must render at a fixed, predictable
   size, never scale with the image's intrinsic dimensions */
.event-identity {
  display: grid;
  place-items: center;
  min-width: 84px;
  max-width: 150px;
  height: 34px;
  overflow: hidden;
}

.event-logo {
  height: 20px;
  max-width: 150px;
  width: auto;
  object-fit: contain;
}

.event-name {
  max-width: 150px;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1.4px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule {
  width: 1px;
  height: 18px;
  background: rgb(255 255 255 / 0.25);
}

.info-slot {
  display: grid;
  justify-items: center;
  align-items: center;
  min-width: 240px;
  max-width: 460px;
  overflow: hidden;
}

.info-text {
  grid-area: 1 / 1;
  font-weight: 800;
  font-size: 16px;
  line-height: 1;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  white-space: nowrap;
  color: #ffffff;
}

.partner-slot {
  display: grid;
  justify-items: center;
  align-items: center;
  width: 60px;
  height: 52px;
}

.partner-logo {
  grid-area: 1 / 1;
  height: 30px;
  width: auto;
  max-width: 60px;
  object-fit: contain;
}
</style>
