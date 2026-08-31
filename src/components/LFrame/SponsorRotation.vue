<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import blueBottleLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import FadeTransition from '../../transitions/FadeTransition.vue'

const sponsorLogos = [leagueBroadcastLogo, blueBottleLogo]
const currentLogoIndex = ref(0)
const logoRotationInterval = 15000 // Rotate logo every 15 seconds
const rotationTimer = ref<number | null>(null)

onMounted(() => {
  rotationTimer.value = setInterval(() => {
    currentLogoIndex.value = (currentLogoIndex.value + 1) % sponsorLogos.length
  }, logoRotationInterval)
})

onUnmounted(() => {
  if (rotationTimer.value !== null) {
    clearInterval(rotationTimer.value)
  }
})
</script>

<template>
  <div class="logo-slot w-full h-full">
    <FadeTransition mode="out-in">
      <img :key="currentLogoIndex" :src="sponsorLogos[currentLogoIndex]" class="sponsor-logo" />
    </FadeTransition>
  </div>
</template>

<style lang="css" scoped>
.logo-slot {
  display: grid;
  grid-template-rows: 100%;
  grid-template-columns: 100%;
  overflow: hidden;
  /* Vertical padding cut 18px -> 13px to match the 10px-shorter footer, so the logo's
     content box (footer height - 2*padding) is unchanged and the mark renders the same size. */
  padding: 13px 24px;
}

.sponsor-logo {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
