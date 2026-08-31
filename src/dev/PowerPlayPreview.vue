<script setup lang="ts">
import Scoreboard from '@/components/Scoreboard/Scoreboard.vue'
import ObjectivePowerPlayContainer from '@/components/ObjectivePowerPlay/ObjectivePowerPlayContainer.vue'
</script>

<template>
  <div class="overlay">
    <Scoreboard class="overlay-scoreboard" />
    <ObjectivePowerPlayContainer />
  </div>
</template>

<style>
/* Mirror of the global styles from App.vue so components render identically */
@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Theme tokens come from style.css (shared with the main app). */
}

html,
body {
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  /* stand-in for game footage so the overlay is readable in screenshots */
  background: linear-gradient(160deg, #2a3440 0%, #151a21 60%, #10131a 100%);
  /* Match the production display font. */
  font-family: 'Bebas Neue';
  font-variant-numeric: tabular-nums;
  color: #e2e8f0;
}
</style>

<style scoped>
.overlay {
  position: relative;
  width: 1920px;
  height: 1080px;
}

.overlay-scoreboard {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
