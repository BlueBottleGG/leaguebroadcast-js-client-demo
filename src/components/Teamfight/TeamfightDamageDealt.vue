<script setup lang="ts">
import { computed } from 'vue'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { laneIndexFromRole } from '@/utils/laneOrder'
import DamageGraphPanel, { type DamageGraphPanelEntry } from './DamageGraphPanel.vue'

const data = useIngameSelector((state) => state.gameData.damageGraph)

const entries = computed<DamageGraphPanelEntry[]>(() =>
  (data.value?.damageDealt ?? []).map((entry, index) => ({
    key: `${entry.team}:${entry.name}:${index}`,
    champion: entry.champion,
    displayName: playerDisplayName(entry, entry.champion?.name),
    team: entry.team,
    laneIndex: laneIndexFromRole(entry.role),
    totalDamage: entry.totalDamageDealt ?? 0,
    damageByType: entry.damageByType,
  })),
)
</script>

<template>
  <DamageGraphPanel title="Damage Dealt" :entries="entries" />
</template>
