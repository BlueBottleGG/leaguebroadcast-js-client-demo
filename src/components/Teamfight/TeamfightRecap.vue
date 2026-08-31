<script setup lang="ts">
import { computed } from 'vue'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import type { teamfightTimelinePlayer } from '@bluebottle_gg/league-broadcast-client'
import DamageGraphPanel, { type DamageGraphPanelEntry } from './DamageGraphPanel.vue'

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
    }
  })
})

// The fight window identifies a new recap even when the same ten players are
// present, so replacing the latest backend payload replays the bar entrance.
const renderKey = computed(() =>
  data.value ? `${data.value.startTime}:${data.value.endTime}` : '',
)
</script>

<template>
  <DamageGraphPanel title="Teamfight Damage" :entries="entries" :render-key="renderKey" />
</template>
