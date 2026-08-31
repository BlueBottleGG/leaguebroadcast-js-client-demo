<script setup lang="ts">
import TeamfightRecap from '@/components/Teamfight/TeamfightRecap.vue'
import TeamfightDamageDealt from '@/components/Teamfight/TeamfightDamageDealt.vue'
import CompactTeamfight from '@/components/Teamfight/CompactTeamfight.vue'

// ?view=compact renders the bar on its own, so it can sit at its production
// position. In the other views the recap/damage-dealt panels take over that
// same footprint, so the bar is lifted above them and both stay screenshottable.
const compactOnly = new URLSearchParams(window.location.search).get('view') === 'compact'
</script>

<template>
  <div class="overlay">
    <div class="overlay-teamfight-panels">
      <TeamfightRecap />
      <TeamfightDamageDealt />
    </div>
    <!-- CompactTeamfight (TeamfightPlayerEntry) is driven by
         teamfightDamageOverview, a separate feed from the recap/damage-dealt
         panels above, so it renders in every view for buff-indicator
         screenshots — lifted out of the panels' higher-stacking takeover
         footprint (see .overlay-teamfight-panels in overlay-layout.css)
         unless it is the only thing on screen. -->
    <CompactTeamfight :class="compactOnly ? 'overlay-teamfight' : 'preview-teamfight-compact'" />
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

.overlay-teamfight-panels {
  position: absolute;
  bottom: 0;
  left: calc(285px + 176px);
  right: calc(285px + 176px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 20;
  isolation: isolate;
}

/* Mirror of #app .overlay-teamfight from views/overlay-layout.css (not
   imported here), with .preview-teamfight-compact shifted up above the
   recap/damage-dealt panels' footprint so both can be screenshotted at once. */
.overlay-teamfight,
.preview-teamfight-compact {
  position: absolute;
  left: calc(285px + 176px);
  right: calc(285px + 176px);
  height: 260px;
}

.overlay-teamfight {
  bottom: 0px;
}

.preview-teamfight-compact {
  bottom: 600px;
}
</style>
