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
 * Single element — diagonal broadcast-accent gradient,
 * masked so only the border ring is visible and the center is fully transparent.
 * Safe for OBS browser-source overlays with no chroma key required.
 */
.minimap-frame {
  pointer-events: none;

  /*
     * The colour fill: brand accent fading through black at the diagonal.
     * --accent-reach (registered below) sets where the accent hands over to
     * black; animating it makes the two corner fills slowly swell and recede.
     */
  background: linear-gradient(
    var(--accent-angle) in oklab,
    var(--broadcast-accent) 0%,
    rgba(0, 0, 0, 1) var(--accent-reach),
    rgba(0, 0, 0, 1) calc(100% - var(--accent-reach)),
    var(--broadcast-accent) 100%
  );
  /* different periods so the two motions drift in and out of phase */
  animation:
    accent-breathe 20s ease-in-out infinite,
    accent-drift 33s ease-in-out infinite;

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

/*
 * Registered so the gradient stop interpolates smoothly (plain custom
 * properties snap between keyframes instead of animating).
 * 45% matches the previous static gradient — that is the resting state.
 */
@property --accent-reach {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 45%;
}

/* Gradient direction — animating it slides the bright spots along the edges */
@property --accent-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 45deg;
}

/*
 * Slow breathing of the corner colours: the accent pulls back along the
 * diagonal, then swells out to its resting reach again. Kin to the power play
 * sheen, but it animates the frame's own fill instead of layering a band on top.
 */
@keyframes accent-breathe {
  0%,
  100% {
    --accent-reach: 45%;
  }

  50% {
    --accent-reach: 34%;
  }
}

/*
 * Slow wander of the highlight point: tilting the gradient slides the two
 * bright corners back and forth along the frame edges.
 */
@keyframes accent-drift {
  0%,
  100% {
    --accent-angle: 45deg;
  }

  30% {
    --accent-angle: 64deg;
  }

  70% {
    --accent-angle: 26deg;
  }
}
</style>
