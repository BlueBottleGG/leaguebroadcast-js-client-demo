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

const entries = computed<DamageGraphPanelEntry[]>(() =>
  ((data.value?.players ?? []) as TeamfightPlayerWithDamageTypes[]).map((player, index) => ({
    key: `${player.team}:${player.name}:${index}`,
    champion: player.champion,
    displayName: playerDisplayName(player, player.champion?.name),
    team: player.team,
    totalDamage: player.totalDamage ?? 0,
    damageByType: player.damageByType,
  })),
)

// The fight window identifies a new recap even when the same ten players are
// present, so replacing the latest backend payload replays the bar entrance.
const renderKey = computed(() =>
  data.value ? `${data.value.startTime}:${data.value.endTime}` : '',
)
</script>

<template>
  <DamageGraphPanel title="Teamfight Damage" :entries="entries" :render-key="renderKey" />
</template>
