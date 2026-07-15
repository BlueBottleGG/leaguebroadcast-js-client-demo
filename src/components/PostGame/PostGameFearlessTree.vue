<script setup lang="ts">
import { computed } from 'vue'
import type { simpleChampionData } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { useFearlessBans, useMatchData } from '@/composables/usePostGameScreens'
import PostGameScreenFrame from './PostGameScreenFrame.vue'

/**
 * Fearless tree screen: a horizontal bracket of per-game ban nodes. Each node
 * shows the current game's blue/red ban rows in full colour; games after the
 * first additionally stack small greyscale rows of every prior game's bans
 * (team 1 above the current block, team 2 below) so the accumulation reads
 * top-to-bottom around a fixed center. If the match has a further,
 * not-yet-played game, a trailing "next game" node previews the full
 * accumulated ban history with an "Up Next" chip.
 */
const bans = useFearlessBans()
const match = useMatchData()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

// Sorted game keys present in the bans record (keys may be sparse/0-based) —
// mirrors PostGameFearlessDraft's convention of sequential G1/G2/G3 labels.
const gameKeys = computed(() =>
  Object.keys(bans.value ?? {})
    .map(Number)
    .sort((a, b) => a - b),
)

// Two side keys observed across the record, sorted ascending (100 blue / 200
// red per getPostGameSides' documented convention) so "team 1"/"team 2" is
// stable regardless of which side is which numerically.
const sideKeys = computed(() => {
  const src = bans.value
  if (!src) return []
  const set = new Set<number>()
  for (const key of gameKeys.value) {
    Object.keys(src[key] ?? {})
      .map(Number)
      .forEach((s) => set.add(s))
  }
  return Array.from(set).sort((a, b) => a - b)
})
const team1Side = computed(() => sideKeys.value[0])
const team2Side = computed(() => sideKeys.value[1])

function bansFor(gameKey: number, side?: number): simpleChampionData[] {
  if (side === undefined) return []
  return bans.value?.[gameKey]?.[side] ?? []
}

interface GameNode {
  label: string
  team1Current: simpleChampionData[]
  team2Current: simpleChampionData[]
  // prior-game grey rows, oldest first
  team1Prior: simpleChampionData[][]
  team2Prior: simpleChampionData[][]
}

const nodes = computed<GameNode[]>(() =>
  gameKeys.value.map((key, i) => {
    const priorKeys = gameKeys.value.slice(0, i)
    return {
      label: `GAME ${i + 1}`,
      team1Current: bansFor(key, team1Side.value),
      team2Current: bansFor(key, team2Side.value),
      team1Prior: priorKeys.map((pk) => bansFor(pk, team1Side.value)),
      team2Prior: priorKeys.map((pk) => bansFor(pk, team2Side.value)),
    }
  }),
)

// Trailing "next game" node: only when the match reports a further,
// not-yet-complete game beyond the ones we have ban data for.
const nextGameNode = computed<GameNode | null>(() => {
  const games = match.value?.games ?? []
  const incomplete = games.find((g) => !g.isComplete)
  if (!incomplete) return null
  return {
    label: `GAME ${gameKeys.value.length + 1}`,
    team1Current: [],
    team2Current: [],
    team1Prior: gameKeys.value.map((k) => bansFor(k, team1Side.value)),
    team2Prior: gameKeys.value.map((k) => bansFor(k, team2Side.value)),
  }
})

const hasData = computed(() => nodes.value.length > 0)
</script>

<template>
  <PostGameScreenFrame title="Fearless Draft" subtitle="Ban history">
    <div v-if="hasData" class="bracket">
      <template v-for="(node, i) in nodes" :key="`node-${i}`">
        <div class="game-node">
          <div v-if="node.team1Prior.length" class="prior-stack prior-top">
            <div v-for="(row, ri) in node.team1Prior" :key="`t1-${i}-${ri}`" class="prior-row">
              <div v-for="(c, ci) in row" :key="`t1-${i}-${ri}-${ci}`" class="prior-icon">
                <img
                  :src="cacheUrl(c.squareImg)"
                  :alt="c.name"
                  @error="handleImageError"
                  @load="handleImageLoad"
                />
              </div>
            </div>
          </div>

          <span class="node-label">{{ node.label }}</span>
          <div class="current-block">
            <div class="current-row">
              <div
                v-for="(c, ci) in node.team1Current"
                :key="`cur1-${i}-${ci}`"
                class="current-icon"
              >
                <img
                  :src="cacheUrl(c.squareImg)"
                  :alt="c.name"
                  @error="handleImageError"
                  @load="handleImageLoad"
                />
              </div>
            </div>
            <div class="current-row">
              <div
                v-for="(c, ci) in node.team2Current"
                :key="`cur2-${i}-${ci}`"
                class="current-icon"
              >
                <img
                  :src="cacheUrl(c.squareImg)"
                  :alt="c.name"
                  @error="handleImageError"
                  @load="handleImageLoad"
                />
              </div>
            </div>
          </div>

          <div v-if="node.team2Prior.length" class="prior-stack prior-bottom">
            <div v-for="(row, ri) in node.team2Prior" :key="`t2-${i}-${ri}`" class="prior-row">
              <div v-for="(c, ci) in row" :key="`t2-${i}-${ri}-${ci}`" class="prior-icon">
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

        <div class="connector">
          <span class="connector-line" />
          <span class="connector-chevron">&#9656;</span>
        </div>
      </template>

      <div v-if="nextGameNode" class="game-node next-node">
        <div v-if="nextGameNode.team1Prior.length" class="prior-stack prior-top">
          <div v-for="(row, ri) in nextGameNode.team1Prior" :key="`nt1-${ri}`" class="prior-row">
            <div v-for="(c, ci) in row" :key="`nt1-${ri}-${ci}`" class="prior-icon">
              <img
                :src="cacheUrl(c.squareImg)"
                :alt="c.name"
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </div>
          </div>
        </div>

        <span class="node-label">{{ nextGameNode.label }}</span>
        <span class="next-chip">Up Next</span>

        <div v-if="nextGameNode.team2Prior.length" class="prior-stack prior-bottom">
          <div v-for="(row, ri) in nextGameNode.team2Prior" :key="`nt2-${ri}`" class="prior-row">
            <div v-for="(c, ci) in row" :key="`nt2-${ri}-${ci}`" class="prior-icon">
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

    <div v-else class="pg-empty"><span>No Data</span></div>
  </PostGameScreenFrame>
</template>

<style scoped>
.bracket {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

/* ── Game node ── */
.game-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.node-label {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: white;
}

.next-chip {
  padding: 3px 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: white;
  background: var(--broadcast-accent);
  border-radius: var(--radius-pill);
}

.current-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.current-row {
  display: flex;
  gap: 6px;
}

.current-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.4);
}
.current-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Prior (accumulated) grey rows ── */
.prior-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.prior-top {
  margin-bottom: 8px;
}
.prior-bottom {
  margin-top: 8px;
}

.prior-row {
  display: flex;
  gap: 4px;
}

.prior-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.08);
}
.prior-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.85) brightness(0.8);
}

/* ── Connector ── */
.connector {
  width: 48px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.connector-line {
  width: 100%;
  height: 2px;
  background: rgb(255 255 255 / 0.18);
}
.connector-chevron {
  position: absolute;
  color: var(--broadcast-accent);
  font-size: 16px;
  line-height: 1;
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
