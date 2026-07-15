<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import { Team } from '@bluebottle_gg/league-broadcast-client'
import { computed } from 'vue'
import brandEmblem from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import TeamfightPlayerEntry from './TeamfightPlayerEntry.vue'

const teamfight = useIngameSelector((state) => state.gameData.teamfightDamageOverview)

const blueEntries = computed(
  () => teamfight?.value?.damageDealt.filter((entry) => entry.team === Team.Order) || [],
)
const redEntries = computed(
  () => teamfight?.value?.damageDealt.filter((entry) => entry.team === Team.Chaos) || [],
)

// Center-out reveal order (0 = innermost, nearest the center logo).
// Blue sits left of center, so the rightmost/last entry is innermost.
// Red sits right of center, so the leftmost/first entry is innermost.
// The stagger is a pure CSS keyframe animation keyed off this order — the entry
// row re-renders every game frame (damage values update), and an imperatively
// set style.transition would get clobbered by Vue's per-frame style patch,
// which is what made the pop-in order look random.
const blueOrder = (index: number) => blueEntries.value.length - 1 - index
const redOrder = (index: number) => index
</script>

<template>
  <Transition name="slide-down">
    <div v-if="teamfight" class="teamfight-container">
      <div class="team-container order">
        <TeamfightPlayerEntry
          class="team-entry"
          v-for="(entry, index) in blueEntries"
          :key="index"
          :data="entry"
          :style="{ '--enter-order': blueOrder(index) }"
        >
        </TeamfightPlayerEntry>
      </div>
      <div class="teamfight-logo">
        <img :src="brandEmblem" class="teamfight-logo-emblem" alt="BlueBottle" />
        <img :src="leagueBroadcastLogo" class="teamfight-logo-lockup" alt="League Broadcast" />
      </div>

      <div class="team-container chaos">
        <TeamfightPlayerEntry
          class="team-entry"
          v-for="(entry, index) in redEntries"
          :key="index"
          :data="entry"
          mirror
          :style="{ '--enter-order': redOrder(index) }"
        >
        </TeamfightPlayerEntry>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
.teamfight-container {
  display: grid;
  grid-template-columns: 1fr 100px 1fr;
  grid-template-rows: auto;
  align-items: center;
  background: linear-gradient(to bottom, rgba(30, 30, 30, 0), rgba(10, 10, 10, 0.85));
}

.team-container {
  display: flex;
  flex-direction: row;
  gap: 4px;
  padding: 8px;
  height: 100%;
  align-items: flex-end;
  background-origin: border-box;
}

/* Blue: gradient border on left (top→bottom) and bottom (right→left), meeting at bottom-left */
.team-container.order {
  background:
    linear-gradient(to bottom, transparent, var(--blue-team-color)) left / 5px 100% no-repeat,
    linear-gradient(to left, transparent, var(--blue-team-color)) bottom / 100% 5px no-repeat;
}

/* Red: gradient border on right (top→bottom) and bottom (left→right), meeting at bottom-right */
.team-container.chaos {
  background:
    linear-gradient(to bottom, transparent, var(--red-team-color)) right / 5px 100% no-repeat,
    linear-gradient(to right, transparent, var(--red-team-color)) bottom / 100% 5px no-repeat;
}

.team-entry {
  flex: 1;
  width: 100%;
  /* Center-out pop-in: entries with a lower --enter-order (nearer the center
     logo) reveal first. Runs once on mount; because it's a class-driven
     animation (not an inline transition) Vue's per-frame style patches of the
     entry — from live damage updates — don't interrupt or reset it. */
  opacity: 0;
  animation: teamfight-entry-pop 0.3s ease forwards;
  animation-delay: calc(0.5s + var(--enter-order, 0) * 0.1s);
}

@keyframes teamfight-entry-pop {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.teamfight-logo {
  margin-top: auto;
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.teamfight-logo-emblem {
  width: 44px;
  height: 44px;
}

.teamfight-logo-lockup {
  width: 84px;
  object-fit: contain;
}

.slide-down-enter-active {
  transition: transform 0.3s ease 0.3s;
}

.slide-down-leave-active {
  transition: transform 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(100%);
}
</style>
