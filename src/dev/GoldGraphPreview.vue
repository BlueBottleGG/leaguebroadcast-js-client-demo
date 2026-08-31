<script setup lang="ts">
import GoldGraph from '@/components/GoldGraph/GoldGraph.vue'

const isPlayerScoreboardVariant =
  new URLSearchParams(window.location.search).get('variant') === 'player-scoreboard'
</script>

<template>
  <div class="overlay">
    <GoldGraph
      :variant="isPlayerScoreboardVariant ? 'player-scoreboard' : 'full'"
      class="overlay-goldgraph"
      :class="{ 'overlay-goldgraph--player-scoreboard': isPlayerScoreboardVariant }"
    />
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

.overlay-goldgraph {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 1600px;
}

.overlay-goldgraph--player-scoreboard {
  bottom: 0;
  left: calc(285px + 176px);
  width: 998px;
  height: 260px;
  transform: none;
}
</style>
