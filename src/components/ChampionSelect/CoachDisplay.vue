<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import { resolveCoaches } from '@/composables/useChampSelect'

const props = defineProps<{
  team: championSelectTeam
  side: 'blue' | 'red'
}>()

const coaches = computed(() => resolveCoaches(props.team))
const teamName = computed(
  () => props.team.metaData?.tag || props.team.metaData?.name || props.side.toUpperCase(),
)

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
        <span class="label">COACH · {{ teamName }}</span>
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

/* sits inline next to the team's ban row */
.coach-plate {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 48px;
  padding: 0 14px;
  background: linear-gradient(to bottom, rgba(8, 12, 20, 0.9), rgba(4, 6, 10, 0.82));
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
  font-family: 'Bebas Neue', sans-serif;
  font-size: 12px;
  letter-spacing: 2px;
  color: #94a3b8;
  line-height: 1;
}
.names {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 22px;
  letter-spacing: 1px;
  color: #f1f5f9;
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
