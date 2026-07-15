<script setup lang="ts">
defineProps<{
  itemIcon?: string
  itemName?: string
  visible: boolean
  exiting: boolean
  mirror?: boolean
}>()
</script>

<template>
  <!-- Spans order-items+order-info (left 465px) or chaos-info+chaos-items (right 465px) -->
  <div class="item-buy-overlay" :class="{ 'is-visible': visible, 'is-exiting': exiting, mirror }">
    <!-- Accent leading edge — flashes bright, settles to a thin brand line -->
    <span class="item-buy-edge" />
    <!-- One-time diagonal glint across the plate -->
    <span class="item-buy-sheen" />

    <div class="item-buy-content" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
      <img v-if="itemIcon" class="item-icon" :src="itemIcon" />
      <span class="item-buy-text">
        <span class="item-buy-label">Purchased</span>
        <span class="item-name">{{ itemName }}</span>
      </span>
    </div>

    <!-- Accent baseline that ties the moment to the brand during hold -->
    <span class="item-buy-underline" />
  </div>
</template>

<style lang="css" scoped>
.item-buy-overlay {
  /* Covers order-items (215px) + order-info (250px) = 465px from the left */
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc(215px + 250px);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  /* Rich near-black plate with only a faint team tint on the trailing edge —
     reads as a designed surface instead of a flat blue box. */
  background: linear-gradient(
    to right,
    rgb(0 0 0 / 0.94) 55%,
    color-mix(in oklab, var(--blue-team-color) 22%, rgb(0 0 0 / 0.9))
  );
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
  transform: translateY(100%);
  opacity: 0;
  /* Spring-ish entrance with a small overshoot */
  transition:
    transform 0.42s cubic-bezier(0.2, 0.9, 0.25, 1.12),
    opacity 0.28s ease-out;
  padding: 0 8px;
}

.item-buy-overlay.mirror {
  /* Covers chaos-info (250px) + chaos-items (215px) = 465px from the right */
  left: unset;
  right: 0;
  justify-content: flex-end;
  background: linear-gradient(
    to left,
    rgb(0 0 0 / 0.94) 55%,
    color-mix(in oklab, var(--red-team-color) 22%, rgb(0 0 0 / 0.9))
  );
}

.item-buy-overlay.is-visible {
  transform: translateY(0);
  opacity: 1;
}

.item-buy-overlay.is-exiting {
  transform: translateY(-100%);
  opacity: 0;
  transition:
    transform 0.3s ease-in,
    opacity 0.3s ease-in;
}

/* --- Accent leading edge -------------------------------------------------
   Sits on the side the plate emerges from. On entry it flashes bright and
   thick, then settles to a thin, glowing brand line during the hold. */
.item-buy-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--broadcast-accent);
  box-shadow: 0 0 10px 1px color-mix(in oklab, var(--broadcast-accent) 70%, transparent);
  opacity: 0;
  transform: scaleX(1);
  transform-origin: left center;
}
.item-buy-overlay.mirror .item-buy-edge {
  left: unset;
  right: 0;
  transform-origin: right center;
}
.item-buy-overlay.is-visible .item-buy-edge {
  animation: edge-flash 0.5s ease-out 0.06s both;
}

@keyframes edge-flash {
  0% {
    opacity: 0;
    transform: scaleX(4);
  }
  35% {
    opacity: 1;
    transform: scaleX(4);
  }
  100% {
    opacity: 0.9;
    transform: scaleX(1);
  }
}

/* --- One-time sheen glint ------------------------------------------------- */
.item-buy-sheen {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 35%;
  background: linear-gradient(
    100deg,
    transparent,
    rgb(255 255 255 / 0.12) 45%,
    color-mix(in oklab, var(--broadcast-accent) 35%, transparent) 55%,
    transparent
  );
  transform: skewX(-18deg);
  opacity: 0;
  pointer-events: none;
}
.item-buy-overlay.is-visible .item-buy-sheen {
  animation: sheen-pass 0.9s ease-out 0.22s both;
}
.item-buy-overlay.mirror .item-buy-sheen {
  animation-direction: reverse;
}

@keyframes sheen-pass {
  0% {
    left: -40%;
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    left: 130%;
    opacity: 0;
  }
}

.item-buy-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  z-index: 1;
}

/* --- Icon: accent-framed with glow + entry pop -------------------------- */
.item-icon {
  width: 30px;
  height: 30px;
  border: var(--brand-border-width) solid color-mix(in oklab, var(--broadcast-accent) 80%, white 20%);
  border-radius: var(--radius-sm);
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.6),
    0 0 12px 1px color-mix(in oklab, var(--broadcast-accent) 55%, transparent);
  flex-shrink: 0;
}
.item-buy-overlay.is-visible .item-icon {
  animation: icon-pop 0.45s cubic-bezier(0.2, 0.9, 0.25, 1.2) 0.08s both;
}

@keyframes icon-pop {
  0% {
    opacity: 0;
    transform: scale(0.72);
  }
  60% {
    opacity: 1;
    transform: scale(1.06);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* --- Text: staggered in behind the icon ---------------------------------- */
.item-buy-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.05;
  min-width: 0;
  opacity: 0;
  transform: translateX(-10px);
  transition:
    opacity 0.3s ease-out 0.16s,
    transform 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.08) 0.16s;
}
.flex-row-reverse .item-buy-text {
  align-items: flex-end;
  text-align: right;
  transform: translateX(10px);
}
.item-buy-overlay.is-visible .item-buy-text {
  opacity: 1;
  transform: translateX(0);
}

.item-buy-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--broadcast-accent);
  text-shadow: 0 0 6px color-mix(in oklab, var(--broadcast-accent) 60%, transparent);
}

.item-name {
  font-weight: 800;
  font-size: 22px;
  color: white;
  text-shadow: 0 1px 4px rgb(0 0 0 / 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --- Accent baseline underline ------------------------------------------ */
.item-buy-underline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(
    to right,
    var(--broadcast-accent),
    color-mix(in oklab, var(--broadcast-accent) 25%, transparent)
  );
  transform: scaleX(0);
  transform-origin: left center;
  opacity: 0;
}
.item-buy-overlay.mirror .item-buy-underline {
  background: linear-gradient(
    to left,
    var(--broadcast-accent),
    color-mix(in oklab, var(--broadcast-accent) 25%, transparent)
  );
  transform-origin: right center;
}
.item-buy-overlay.is-visible .item-buy-underline {
  animation: underline-grow 0.5s cubic-bezier(0.2, 0.9, 0.25, 1) 0.12s both;
}

@keyframes underline-grow {
  0% {
    opacity: 0;
    transform: scaleX(0);
  }
  100% {
    opacity: 1;
    transform: scaleX(1);
  }
}
</style>
