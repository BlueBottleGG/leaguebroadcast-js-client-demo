<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import { resolveCoaches } from '@/composables/useChampSelect'

const props = defineProps<{
  team: championSelectTeam
  side: 'blue' | 'red'
}>()

const coaches = computed(() => resolveCoaches(props.team))

// visible for ~10s on scene appearance and again on every draft restart
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let showDelay: ReturnType<typeof setTimeout> | undefined
function show() {
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (visible.value = false), 10000)
}
// the scene build-in sequences coaches last, on the same cue as the
// fearless icons (see ChampionSelectScene's enter choreography)
onMounted(() => (showDelay = setTimeout(show, 1250)))
onUnmounted(() => {
  if (timer) clearTimeout(timer)
  if (showDelay) clearTimeout(showDelay)
})

// draft restart = the team's locked pick/ban count drops back to (near) zero
const lockedCount = computed(
  () =>
    (props.team.slots?.filter((s) => s.champion).length ?? 0) +
    (props.team.bans?.filter((b) => b.champion).length ?? 0),
)
watch(lockedCount, (next, prev) => {
  if (next < prev && next <= 1) show()
})
</script>

<template>
  <div class="coach-clip">
    <Transition name="coach">
      <div
        v-if="coaches.length && visible"
        class="coach-plate"
        :class="side"
        :style="{ '--accent': `var(--${side}-team-color)` }"
      >
        <span class="label">{{ coaches.length === 1 ? 'COACH ' : 'COACHES ' }} </span>
        <span class="names">{{ coaches.join(' · ') }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* clip box: the plate animates vertically inside it, so it can never paint
   over the bans, timer bar, or pick cards mid-transition */
.coach-clip {
  overflow: hidden;
  pointer-events: none;
}

/* sits inline next to the team's ban row — its own tile, styled like the
   ban slots (opaque backing, hairline border, same rounding) */
.coach-plate {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 48px;
  padding: 0 14px;
  background: rgb(0 0 0 / 0.8);
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 3px;
}

.coach-plate.blue {
  text-align: left;
  border-left: 3px solid var(--accent);
}

.coach-plate.red {
  text-align: right;
  border-right: 3px solid var(--accent);
}

.label {
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--broadcast-accent) 60%, #ffffff);
  line-height: 1;
}

.names {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.5px;
  color: #ffffff;
  line-height: 1;
}

/* drops in from above, sinks down and away — both clipped by .coach-clip */
.coach-enter-active,
.coach-leave-active {
  transition:
    transform 0.45s ease,
    opacity 0.45s ease;
}

.coach-enter-from {
  transform: translateY(-110%);
  opacity: 0;
}

.coach-leave-to {
  transform: translateY(110%);
  opacity: 0;
}
</style>
