<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import { Team } from '@bluebottle_gg/league-broadcast-client'
import { computed } from 'vue'
import BlueBottleGGLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg'
import TeamfightPlayerEntry from './TeamfightPlayerEntry.vue'

const teamfight = useIngameSelector((state) => state.gameData.teamfightDamageOverview)

const blueEntries = computed(
  () => teamfight?.value?.damageDealt.filter((entry) => entry.team === Team.Order) || [],
)
const redEntries = computed(
  () => teamfight?.value?.damageDealt.filter((entry) => entry.team === Team.Chaos) || [],
)

const STAGGER_STEP = 0.1
const BASE_DELAY = 0.5

function onBeforeEnter(el: Element) {
  const htmlEl = el as HTMLElement
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateY(100%)'
}

function makeEnterHandler(
  getDelay: (index: number, total: number) => number,
  getTotal: () => number,
) {
  return (el: Element, done: () => void) => {
    const htmlEl = el as HTMLElement
    const index = parseInt((htmlEl as HTMLElement).dataset.index ?? '0')
    const delay = BASE_DELAY + getDelay(index, getTotal())
    htmlEl.style.transition = `opacity 0.3s ease ${delay}s, transform 0.3s ease ${delay}s`
    // force reflow
    void htmlEl.offsetHeight
    htmlEl.style.opacity = '1'
    htmlEl.style.transform = 'translateY(0)'
    htmlEl.addEventListener('transitionend', done, { once: true })
  }
}

// Blue: inside = highest index (rightmost), outside = 0 (leftmost)
const onBlueEnter = makeEnterHandler(
  (index, total) => (total - 1 - index) * STAGGER_STEP,
  () => blueEntries.value.length,
)

// Red: inside = index 0 (leftmost), outside = highest index (rightmost)
const onRedEnter = makeEnterHandler(
  (index) => index * STAGGER_STEP,
  () => redEntries.value.length,
)
</script>

<template>
  <Transition name="slide-down">
    <div v-if="teamfight" class="teamfight-container">
      <div class="team-container order">
        <TransitionGroup appear @before-enter="onBeforeEnter" @enter="onBlueEnter">
          <TeamfightPlayerEntry
            class="team-entry"
            v-for="(entry, index) in blueEntries"
            :key="index"
            :data="entry"
            :data-index="index"
          >
          </TeamfightPlayerEntry>
        </TransitionGroup>
      </div>
      <BlueBottleGGLogo class="teamfight-logo" />

      <div class="team-container chaos">
        <TransitionGroup appear @before-enter="onBeforeEnter" @enter="onRedEnter">
          <TeamfightPlayerEntry
            class="team-entry"
            v-for="(entry, index) in redEntries"
            :key="index"
            :data="entry"
            mirror
            :data-index="index"
          >
          </TeamfightPlayerEntry>
        </TransitionGroup>
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
  background: linear-gradient(to bottom, rgba(30, 30, 30, 0), rgba(10, 10, 10, 1));
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
}

.teamfight-logo {
  margin-top: auto;
  height: 100px;
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
