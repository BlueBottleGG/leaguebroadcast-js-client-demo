<script setup lang="ts">
import { computed } from 'vue'
import type { simpleChampionData } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { useFearlessBans } from '@/composables/usePostGameScreens'
import PostGameScreenFrame from './PostGameScreenFrame.vue'
import topIcon from '@/assets/lane/top-placeholder-cropped.svg'
import jglIcon from '@/assets/lane/jgl-placeholder-cropped.svg'
import midIcon from '@/assets/lane/mid-placeholder-cropped.svg'
import botIcon from '@/assets/lane/bot-placeholder-cropped.svg'
import supIcon from '@/assets/lane/sup-placeholder-cropped.svg'

/**
 * Fearless bans screen: five role columns; under each, the champions banned at
 * that role across the prior games, grouped per game with a G1/G2/G3 label. The
 * fearless bans record is role-ordered (index i → role i), mirroring
 * FearlessBanBar's convention.
 */
const bans = useFearlessBans()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

const ROLES = [
  { name: 'Top', icon: topIcon },
  { name: 'Jungle', icon: jglIcon },
  { name: 'Mid', icon: midIcon },
  { name: 'Bot', icon: botIcon },
  { name: 'Support', icon: supIcon },
]

interface GameGroup {
  label: string
  champs: simpleChampionData[]
}

// Sorted game keys, sequentially labelled G1/G2/G3 (keys may be sparse/0-based).
const gameKeys = computed(() =>
  Object.keys(bans.value ?? {})
    .map(Number)
    .sort((a, b) => a - b),
)

// For a given role index, gather each game's ban at that index (both sides).
function groupsForRole(roleIndex: number): GameGroup[] {
  const src = bans.value
  if (!src) return []
  return gameKeys.value
    .map((key, i) => {
      const perSide = src[key] ?? {}
      const champs: simpleChampionData[] = []
      Object.keys(perSide)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((side) => {
          const c = perSide[side]?.[roleIndex]
          if (c) champs.push(c)
        })
      return { label: `G${i + 1}`, champs }
    })
    .filter((g) => g.champs.length > 0)
}

const columns = computed(() => ROLES.map((role, i) => ({ ...role, groups: groupsForRole(i) })))

const hasData = computed(() => columns.value.some((c) => c.groups.length > 0))
</script>

<template>
  <PostGameScreenFrame title="Fearless Bans" subtitle="Bans by role">
    <div v-if="hasData" class="columns">
      <div v-for="col in columns" :key="col.name" class="role-col">
        <div class="role-head">
          <img class="lane-icon" :src="col.icon" :alt="col.name" />
          <span class="role-name">{{ col.name }}</span>
        </div>
        <div class="games">
          <div v-for="grp in col.groups" :key="grp.label" class="game-group">
            <span class="game-label">{{ grp.label }}</span>
            <div class="ban-squares">
              <div v-for="(c, i) in grp.champs" :key="`${grp.label}-${i}`" class="ban-square">
                <img
                  :src="cacheUrl(c.squareImg)"
                  :alt="c.name"
                  @error="handleImageError"
                  @load="handleImageLoad"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="pg-empty"><span>No Data</span></div>
  </PostGameScreenFrame>
</template>

<style scoped>
.columns {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 24px;
}

.role-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 20px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.role-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
}

.lane-icon {
  width: 34px;
  height: 34px;
  color: var(--broadcast-accent);
}

.role-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: white;
}

.games {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.game-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.game-label {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: color-mix(in oklab, var(--broadcast-accent) 60%, white);
}

.ban-squares {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ban-square {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.08);
}
.ban-square img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.7);
}

/* ── Empty ── */
.pg-empty {
  flex: 1;
  display: grid;
  place-items: center;
}
.pg-empty span {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.4);
}
</style>
