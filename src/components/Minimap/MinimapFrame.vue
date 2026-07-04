<script setup lang="ts">
import { useIsInGame } from '@/composables/useIngame'
import FadeTransition from '../../transitions/FadeTransition.vue'

const isInGame = useIsInGame()
</script>

<template>
  <FadeTransition>
    <div v-if="isInGame" class="minimap-frame" />
  </FadeTransition>
</template>

<style scoped>
/*
 * Single element — diagonal blue (top-left) → red (bottom-right) gradient,
 * masked so only the border ring is visible and the center is fully transparent.
 * Safe for OBS browser-source overlays with no chroma key required.
 */
.minimap-frame {
  pointer-events: none;

  /* The colour fill: diagonal blue → red */
  background: linear-gradient(
    45deg in oklab,
    var(--blue-team-color) 0%,
    rgba(0, 0, 0, 1) 45%,
    rgba(0, 0, 0, 1) 55%,
    var(--red-team-color) 100%
  );

  /*
     * Mask: opaque around the edges, fully transparent in the center.
     * The inner rectangle is defined as a % inset — adjust to taste.
     * Two mask layers combined with 'exclude' punch the hole:
     *   layer 1 — full white rectangle (show everything)
     *   layer 2 — white rectangle inset by --border-width (subtract the center)
     * mask-composite: exclude = layer1 XOR layer2 → only the ring remains.
     */
  --border-width: 10px;
  mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  mask-size:
    100% 100%,
    calc(100% - var(--border-width) * 2) calc(100% - var(--border-width) * 2);
  mask-position: center, center;
  mask-repeat: no-repeat, no-repeat;
  mask-composite: exclude;
  -webkit-mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  -webkit-mask-size:
    100% 100%,
    calc(100% - var(--border-width) * 2) calc(100% - var(--border-width) * 2);
  -webkit-mask-position: center, center;
  -webkit-mask-repeat: no-repeat, no-repeat;
  -webkit-mask-composite: xor;
  border: 2px solid rgba(0, 0, 0, 1);
}
</style>
