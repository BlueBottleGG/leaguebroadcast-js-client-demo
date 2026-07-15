<script setup lang="ts">
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import blueBottleLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
</script>

<template>
  <div class="brand-lockup">
    <img class="league-logo" :src="leagueBroadcastLogo" alt="League Broadcast" />
    <span class="rule" />
    <img class="blue-bottle-logo" :src="blueBottleLogo" alt="BlueBottle" />
  </div>
</template>

<style scoped>
.brand-lockup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
}

.league-logo {
  width: 260px;
  height: 48px;
  object-fit: contain;
}

.blue-bottle-logo {
  width: 46px;
  height: 46px;
}

.rule {
  width: 1px;
  height: 40px;
  background: rgb(255 255 255 / 0.2);
}
</style>
