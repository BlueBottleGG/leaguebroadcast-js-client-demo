<script setup lang="ts">
import type { banSlot } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'

const props = defineProps<{
  bans: banSlot[]
  team: 'blue' | 'red'
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)
</script>

<template>
  <div class="ban-row" :class="`team-${team}`">
    <TransitionGroup name="ban">
      <div
        v-for="(ban, i) in bans"
        :key="i"
        class="ban-slot"
        :class="{ active: ban.isActive, empty: !ban.champion, done: ban.champion && !ban.isActive }"
        :style="{ '--bi': i }"
      >
        <img
          v-if="ban.champion"
          class="ban-img"
          :src="cacheUrl(ban.champion.squareImg)"
          :alt="ban.champion.name"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <span class="strike" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ban-row {
  display: flex;
  gap: 6px;
  height: 48px;
}
.team-red {
  flex-direction: row-reverse;
}

.ban-slot {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 3px;
  overflow: hidden;
  background: rgb(0 0 0 / 0.7);
  border: 1px solid rgb(255 255 255 / 0.14);
}
.ban-slot.empty {
  background: rgb(0 0 0 / 0.8);
}

/* full colour while the ban is active/hovered; desaturates only once the ban
   completes (see .ban-slot.done), matching the ban-flash gray-out end state */
.ban-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1) brightness(1);
  transition: filter 0.45s ease;
}
.ban-slot.done .ban-img {
  filter: saturate(0) brightness(0.55);
}

/* diagonal strike in team color — slashes bottom-left → top-right once the ban
   completes. Line is pinned just inside the bottom-left corner and rotated
   -45deg toward the top-right; scaleX from the left end makes it draw. The
   inset start/short length leave small gaps at both corners. */
.strike {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.strike::after {
  content: '';
  position: absolute;
  top: calc(100% - 6px);
  left: 5px;
  /* short of the full diagonal (~141%) so both ends stop before the corners */
  width: 116%;
  height: 2px;
  transform-origin: left center;
  transform: rotate(-45deg) scaleX(0);
}
.ban-slot.done .strike::after {
  animation: ban-slash 0.38s cubic-bezier(0.4, 0, 0.15, 1) forwards;
}
@keyframes ban-slash {
  from {
    transform: rotate(-45deg) scaleX(0);
  }
  to {
    transform: rotate(-45deg) scaleX(1);
  }
}
.team-blue .strike::after {
  background: var(--blue-team-color);
}
.team-red .strike::after {
  background: var(--red-team-color);
}
.ban-slot.empty .strike::after {
  display: none;
}

/* active ban: animated pulsing border ring + outer glow */
.team-blue .ban-slot.active {
  --ban-c: var(--blue-team-color);
}
.team-red .ban-slot.active {
  --ban-c: var(--red-team-color);
}
/* ring lives on ::after so it paints above the ban image */
.ban-slot.active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 3px;
  pointer-events: none;
  animation: ban-border 1.6s ease-in-out infinite;
}
@keyframes ban-border {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 2px var(--ban-c),
      0 0 3px 0 var(--ban-c);
    opacity: 0.75;
  }
  50% {
    box-shadow:
      inset 0 0 0 3px var(--ban-c),
      0 0 14px 2px var(--ban-c);
    opacity: 1;
  }
}

.ban-enter-active {
  transition:
    transform 0.4s ease,
    opacity 0.4s ease;
}
.ban-enter-from {
  transform: translateY(24px);
  opacity: 0;
}
</style>
