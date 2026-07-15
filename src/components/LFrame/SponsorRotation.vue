<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import blueBottleLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import FadeTransition from '../../transitions/FadeTransition.vue'

const sponsorLogos = [leagueBroadcastLogo, blueBottleLogo]
const currentLogoIndex = ref(0)
let rotationTimer: number | undefined

onMounted(() => {
  rotationTimer = window.setInterval(() => {
    currentLogoIndex.value = (currentLogoIndex.value + 1) % sponsorLogos.length
  }, 15000)
})

onUnmounted(() => {
  if (rotationTimer !== undefined) window.clearInterval(rotationTimer)
})
</script>

<template>
  <div class="logo-slot">
    <FadeTransition mode="out-in">
      <img
        :key="currentLogoIndex"
        :src="sponsorLogos[currentLogoIndex]"
        class="sponsor-logo"
        alt=""
      />
    </FadeTransition>
  </div>
</template>

<style scoped>
.logo-slot {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 13px 24px;
  overflow: hidden;
}

.sponsor-logo {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
