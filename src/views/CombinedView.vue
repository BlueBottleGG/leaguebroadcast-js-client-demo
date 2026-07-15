<script setup lang="ts">
// Combined broadcast page (default route "/", also "/combined"): all three
// game-phase scenes stacked in one browser source. Each scene self-gates
// (overlay on useIsInGame, champ select / post-game on their active flags),
// so this shows whichever is live — one source that covers the whole match.
//
// Stacking order (bottom to top): post-game < pre-game (champ select) < ingame.
// Each layer gets an explicit z-index AND its own stacking context (isolation)
// so z-indexes inside a scene (LFrame 100, TeamfightRecap 998, ...) can never
// paint across scene boundaries during transition overlaps.
import OverlayView from './OverlayView.vue'
import ChampionSelectScene from '@/components/ChampionSelect/ChampionSelectScene.vue'
import PostGameScene from '@/components/PostGame/PostGameScene.vue'
</script>

<template>
  <div class="phase-layer postgame-layer">
    <PostGameScene />
  </div>
  <div class="phase-layer champ-select-layer">
    <ChampionSelectScene />
  </div>
  <div class="phase-layer ingame-layer">
    <OverlayView />
  </div>
</template>

<style scoped>
/* Overlay the three 1920x1080 scenes on top of each other rather than letting
   them stack in normal flow. `isolation: isolate` makes every layer its own
   stacking context, so each scene's internal z-indexes are contained and only
   the layer z-indexes below decide which phase wins. */
.phase-layer {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
  isolation: isolate;
}

.postgame-layer {
  z-index: 1;
}

.champ-select-layer {
  z-index: 2;
}

.ingame-layer {
  z-index: 3;
}
</style>
