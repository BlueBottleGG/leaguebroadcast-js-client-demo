<script setup lang="ts">
import { computed } from 'vue'
import type { simpleChampionData } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'

/**
 * Left-hand champion identity block shared by the player-analysis and
 * player-stats screens: champion splash bleeding into black, with the team tag
 * chip, player name and champion name stacked bottom-left.
 */
const props = defineProps<{
  champion: simpleChampionData
  displayName: string
  teamTag?: string
  side: 'blue' | 'red'
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

const splash = computed(() =>
  cacheUrl(props.champion.splashCenteredImg || props.champion.splashImg),
)
const championName = computed(() => props.champion.name || props.champion.alias || '')
</script>

<template>
  <div class="pg-identity" :class="`side-${side}`">
    <div class="splash-wrap">
      <img
        class="splash"
        :src="splash"
        :alt="championName"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </div>
    <div class="identity-caption">
      <span v-if="teamTag" class="team-chip">{{ teamTag }}</span>
      <span class="player-name">{{ displayName }}</span>
      <span class="champ-name">{{ championName }}</span>
    </div>
  </div>
</template>

<style scoped>
.pg-identity {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.splash-wrap {
  position: absolute;
  inset: 0;
}

.splash {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
  /* bleed into black on the right edge + bottom */
  -webkit-mask-image:
    linear-gradient(to right, black 55%, transparent 100%),
    linear-gradient(to bottom, black 60%, transparent 100%);
  mask-image:
    linear-gradient(to right, black 55%, transparent 100%),
    linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}

.identity-caption {
  position: absolute;
  left: 0;
  bottom: 0;
  padding: 0 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.team-chip {
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: white;
  border-radius: var(--radius-sm);
}
.side-blue .team-chip {
  background: var(--blue-team-color);
}
.side-red .team-chip {
  background: var(--red-team-color);
}

.player-name {
  font-size: 64px;
  font-weight: 800;
  line-height: 0.98;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  color: white;
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.65);
}

.champ-name {
  font-size: 20px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgb(255 255 255 / 0.55);
}
</style>
