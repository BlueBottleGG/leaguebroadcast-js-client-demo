<script setup lang="ts">
import { computed } from 'vue'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
// White T on the accent square — the title sponsor anchors the panel center.
import brandLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'

const props = defineProps<{
  blueTeam: championSelectTeam
  redTeam: championSelectTeam
  bestOf: number
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

const dotCount = computed(() => (props.bestOf > 1 ? Math.floor(props.bestOf / 2) + 1 : 0))

function teamName(team: championSelectTeam, fallback: string): string {
  return team.metaData?.tag || team.metaData?.name || fallback
}

const sides = computed(() => [
  { key: 'blue' as const, team: props.blueTeam, name: teamName(props.blueTeam, 'BLUE') },
  { key: 'red' as const, team: props.redTeam, name: teamName(props.redTeam, 'RED') },
])

function dotFilled(team: championSelectTeam, i: number) {
  return (team.scoreMatch?.wins ?? 0) >= i
}
</script>

<template>
  <div class="center-panel">
    <div v-for="side in sides" :key="side.key" class="half" :class="side.key">
      <div v-if="dotCount" class="dots">
        <span
          v-for="i in dotCount"
          :key="i"
          class="dot"
          :class="{ filled: dotFilled(side.team, i) }"
        />
      </div>

      <div class="icon-wrap">
        <img
          v-if="side.team.metaData?.iconUri"
          class="team-icon"
          :src="cacheUrl(side.team.metaData.iconUri)"
          :alt="side.name"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <div v-else class="icon-fallback" />
      </div>

      <div class="name-block">
        <div class="team-name" :style="{ '--tn-len': side.name.length }">
          {{ side.name }}
        </div>
        <div v-if="side.team.metaData?.description" class="team-record">
          {{ side.team.metaData.description }}
        </div>
      </div>
    </div>

    <!-- title sponsor between the teams (order puts it visually in the middle) -->
    <img class="brand-center" :src="brandLogo" alt="BlueBottle" />
  </div>
</template>

<style scoped>
.center-panel {
  position: relative;
  display: flex;
  height: 100%;
  padding: 0 4px;
  /* the center panel carries its own backing (the pick-strip has none of its
     own) so the dark plate rides in with it as it pops up; opaque like the
     pick cards flanking it */
  background: rgb(4 6 10 / 0.9);
  /* interior corners only — rounds against the pick strip's dark backing */
  border-radius: 6px 6px 0 0;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.55);
}

/* brand accent: a short centered accent tick on the panel's BOTTOM edge.
   CI rule: accent sits on black/white only — the top edge is out because the
   phase timer's team-colored fill runs directly along it; down here the tick
   only meets black panel above and the screen edge below. */
.center-panel::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 2px;
  background: var(--broadcast-accent);
}

/* halves narrower than before: the sponsor mark takes the middle column, and
   the panel's total width must stay what it was with the two 168px halves
   (2×124 + 88 + 2×4 = 344px) so the pick cards keep their area */
.half {
  width: 124px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px 8px;
}

.half.blue {
  order: 1;
}

.half.red {
  order: 3;
}

/* title sponsor between the teams — replaces the old center divider (and the
   timer dials around the icons). Accent square on the black panel only (CI). */
.brand-center {
  order: 2;
  align-self: center;
  width: 88px;
  height: 88px;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.5);
}

.dots {
  display: flex;
  gap: 6px;
  align-items: center;
  height: 10px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(120, 130, 145, 0.55);
  transform: scale(0.8);
  transition:
    transform 0.3s ease,
    background 0.3s ease;
}

.blue .dot.filled {
  background: var(--blue-team-color);
  transform: scale(1);
}

.red .dot.filled {
  background: var(--red-team-color);
  transform: scale(1);
}

.icon-wrap {
  position: relative;
  width: 100px;
  height: 100px;
  /* names live in a full-width bottom row of their own (see .name-block), so
     the icon centers itself between the dots and the panel bottom */
  margin: auto 0;
}

/* contain + margin-auto: centered, never crops square logos */
.team-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: 82%;
  max-height: 82%;
  width: auto;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

.icon-fallback {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, rgba(30, 41, 59, 0.9), rgba(6, 9, 15, 0.95));
}

/* each name gets its half's width PLUS half the center column: anchored to the
   panel edges (the .half boxes aren't positioned, so these resolve against the
   panel itself), the two rows meet in the middle under the sponsor mark. Blue
   reads outward-in from the left, red mirrors from the right. */
.name-block {
  position: absolute;
  bottom: 10px;
  width: calc(50% - 16px);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.half.blue .name-block {
  left: 12px;
  align-items: flex-start;
  text-align: left;
}

.half.red .name-block {
  right: 12px;
  align-items: flex-end;
  text-align: right;
}

.team-name {
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #ffffff;
  /* Short names stay centered over the team icon: the 116px minimum matches
     the half's inner width, and centered text in it lines up with the icon.
     Longer names grow out of that zone toward the panel center (the block
     anchors them at the outer edge) before any clipping happens. */
  min-width: 116px;
  max-width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* names too long for even the full run shrink instead of clipping:
     230px/len approximates Bebas Neue 900 caps filling the ~156px row; the 24px
     display size stays the cap for everything that fits */
  font-size: clamp(14px, calc(230px / var(--tn-len, 8)), 24px);
}

.blue .team-name {
  color: color-mix(in oklch, var(--blue-team-color) 65%, #ffffff);
}

.red .team-name {
  color: color-mix(in oklch, var(--red-team-color) 65%, #ffffff);
}

.team-record {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
  color: rgb(255 255 255 / 0.65);
  line-height: 1;
  /* always centered under the team icon, regardless of how far the name grew */
  width: 116px;
  text-align: center;
}
</style>
