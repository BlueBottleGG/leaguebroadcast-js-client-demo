<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import type { teamfightTimelinePlayer } from '@bluebottle_gg/league-broadcast-client'
import DamageGraphPanel, { type DamageGraphPanelEntry } from './DamageGraphPanel.vue'
import TeamfightTimelinePanel from './TeamfightTimelinePanel.vue'
import { gameClock } from './teamfightTimelineData'

defineProps<{ sponsorLogo?: string; sponsorName?: string }>()

const data = useIngameSelector((state) => state.gameData.teamfightTimeline)

// The backend's latest-teamfight payload includes the same damage composition
// map used by damageGraph entries. The published 1.12.0 declaration still
// omits that field, so keep the compatibility extension local for now.
type TeamfightPlayerWithDamageTypes = teamfightTimelinePlayer & {
  damageByType?: { [key: string]: number }
}

/**
 * Unlike damageGraph entries, timeline players carry no role tag — the backend
 * builds the list straight from the game snapshot's hero array, which is lane
 * ordered per team. So a player's position within its team *is* its lane slot,
 * the same value the damage graph's role map derives from the hero index.
 * Anything past the fifth slot on a side stays unlabelled rather than guessing.
 */
const entries = computed<DamageGraphPanelEntry[]>(() => {
  const slotsUsed = new Map<number, number>()
  return ((data.value?.players ?? []) as TeamfightPlayerWithDamageTypes[]).map((player, index) => {
    const slot = slotsUsed.get(player.team) ?? 0
    slotsUsed.set(player.team, slot + 1)
    return {
      key: `${player.team}:${player.name}:${index}`,
      champion: player.champion,
      displayName: playerDisplayName(player, player.champion?.name),
      team: player.team,
      laneIndex: slot < 5 ? slot : undefined,
      totalDamage: player.totalDamage ?? 0,
      damageByType: player.damageByType,
      died: player.died,
    }
  })
})

// endTime changes on every live update; only the fight start identifies a new recap.
const renderKey = computed(() => String(data.value?.startTime ?? ''))
const page = ref(0)
const pageCount = computed(() =>
  data.value?.samples?.length || data.value?.kills?.length
    ? 1 + Math.max(1, Math.ceil((data.value?.kills?.length ?? 0) / 5))
    : 1,
)
let pageTimer: ReturnType<typeof setInterval> | undefined
watch([renderKey, pageCount], () => {
  clearInterval(pageTimer)
  page.value = 0
  if (data.value && pageCount.value > 1) {
    pageTimer = setInterval(() => { page.value = (page.value + 1) % pageCount.value }, 6000)
  }
}, { immediate: true })
onUnmounted(() => clearInterval(pageTimer))
</script>

<template>
  <div v-if="data?.players?.length" class="timeline-recap">
    <Transition name="timeline-page">
      <DamageGraphPanel
        v-if="page === 0"
        :key="`overview:${renderKey}`"
        title="Teamfight timeline"
        :entries="entries"
        :render-key="renderKey"
        :sponsor-logo="sponsorLogo"
        :sponsor-name="sponsorName"
      >
        <template #header-context>
          <span class="fight-context">
            {{ gameClock(data.startTime) }} · {{ gameClock(Math.max(0, data.endTime - data.startTime)) }}
            <span class="blue">{{ data.blueKills }}</span>–<span class="red">{{ data.redKills }}</span>
          </span>
        </template>
      </DamageGraphPanel>
      <TeamfightTimelinePanel
        v-else
        :key="`timeline:${renderKey}:${page}`"
        :data="data"
        :page="page"
        :sponsor-logo="sponsorLogo"
        :sponsor-name="sponsorName"
      />
    </Transition>
  </div>
</template>

<style scoped>
.timeline-recap { position: relative; width: 100%; height: 260px; pointer-events: none; font-family: inherit; font-variant-numeric: tabular-nums; }
.timeline-recap > * { position: absolute; inset: 0; }
.fight-context { display: flex; align-items: center; gap: 7px; margin-left: 4px; padding-left: 12px; border-left: 1px solid rgb(255 255 255 / 0.3); color: #d2d8e1; font-size: 16px; font-weight: 800; white-space: nowrap; }
.blue { color: var(--blue-team-color); }
.red { color: var(--red-team-color); }
.timeline-page-enter-active, .timeline-page-leave-active { transition: opacity 250ms ease, transform 350ms cubic-bezier(0.22, 1, 0.36, 1); }
.timeline-page-enter-from { opacity: 0; transform: translateY(18px); }
.timeline-page-leave-to { opacity: 0; transform: translateY(-18px); }
@media (prefers-reduced-motion: reduce) { .timeline-page-enter-active, .timeline-page-leave-active { transition: none; } }
</style>
