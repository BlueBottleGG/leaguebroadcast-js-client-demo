<script setup lang="ts">
import { computed } from 'vue'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import scuttleIcon from '@/assets/scuttle.png'
import towerIcon from '@/assets/tower.png'
import type { KillFeedItem } from './killFeedItem'

const props = defineProps<{
  event: KillFeedItem
}>()

const client = useClient()

const isTurret = computed(() => props.event.objective === 'turret')

const isScuttle = computed(() => {
  const victim = props.event.victim
  return /^sru_crab/i.test(victim.name) || /^sru_crab/i.test(victim.alias)
})

/** Scuttle and turrets ship with the overlay; champions come from the asset cache. */
const isObjective = computed(() => isTurret.value || isScuttle.value)

const victimIcon = computed(() => {
  if (isTurret.value) return towerIcon
  if (isScuttle.value) return scuttleIcon
  return client.getCacheUrl(props.event.victim.squareImg)
})

const victimAlt = computed(() => {
  if (isTurret.value) return 'Turret'
  if (isScuttle.value) return 'Scuttle Crab'
  return props.event.victim.name
})
</script>

<template>
  <div class="kill-entry" :class="event.ingameTeamId === 1 ? 'order' : 'chaos'">
    <!-- Assisters -->
    <div class="assisters">
      <img
        v-for="assister in event.assisters"
        :key="assister.alias"
        :src="client.getCacheUrl(assister.squareImg)"
        class="champ-icon assister-icon"
        :alt="assister.name"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </div>

    <!-- Killer -->
    <img
      v-if="event.killer"
      :src="client.getCacheUrl(event.killer.squareImg)"
      class="champ-icon"
      :alt="event.killer.name"
      @error="handleImageError"
      @load="handleImageLoad"
    />
    <div v-else class="champ-icon placeholder" />

    <!-- Kill separator -->
    <div class="kill-icon-wrapper">
      <div class="kill-icon" aria-hidden="true">⚔</div>
    </div>

    <!-- Victim -->
    <img
      :src="victimIcon"
      class="champ-icon victim-icon"
      :class="{ 'objective-icon': isObjective }"
      :alt="victimAlt"
      @error="handleImageError"
      @load="handleImageLoad"
    />
  </div>
</template>

<style lang="css" scoped>
.kill-entry {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px 8px 4px 6px;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(4px);
  width: 100%;
}

.kill-entry.order {
  background: linear-gradient(
    to left,
    color-mix(in oklch, var(--blue-team-color) 50%, #000000cc) 0px,
    oklch(from var(--blue-team-color) l c h / 0) 120px
  );
  border-right: 3px solid var(--blue-team-color);
}

.kill-entry.chaos {
  background: linear-gradient(
    to left,
    color-mix(in oklch, var(--red-team-color) 50%, #000000cc) 0px,
    oklch(from var(--red-team-color) l c h / 0) 120px
  );
  border-right: 3px solid var(--red-team-color);
}

.assisters {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.champ-icon {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}

.assister-icon {
  width: 32px;
  height: 32px;
}

.placeholder {
  background-color: rgba(255, 255, 255, 0.08);
}

.kill-icon-wrapper {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kill-icon {
  color: rgba(255, 255, 255, 0.85);
  font-size: 24px;
  padding: 0 2px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
}

.victim-icon {
  filter: grayscale(0.5);
}

.victim-icon.objective-icon {
  padding: 5px;
  object-fit: contain;
  background: rgb(0 0 0 / 0.42);
  filter: none;
}
</style>
