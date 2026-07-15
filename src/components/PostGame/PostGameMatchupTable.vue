<script setup lang="ts">
import { computed } from 'vue'
import {
  BestOfType,
  type matchWithGamesAndTeams,
  type teamWithMembers,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { useMatchList } from '@/composables/usePostGameScreens'
import PostGameScreenFrame from './PostGameScreenFrame.vue'

/**
 * Matchup grid: a card per match with team tags, a "VS", and per-team score
 * dots (majority-needed count, filled = wins). Upcoming matches (no completed
 * games) get a dashed border and an "Upcoming" chip.
 */
const matches = useMatchList()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

interface CardTeam {
  team?: teamWithMembers
  tag: string
  icon: string
  wins: number
  isWinner: boolean
}
interface Card {
  matchId: number
  name: string
  dotCount: number
  upcoming: boolean
  left: CardTeam
  right: CardTeam
}

function dotsForBestOf(type: BestOfType): number {
  // majority-needed to win the series
  return Math.max(1, Math.ceil(Number(type) / 2))
}

function winsFor(match: matchWithGamesAndTeams, teamId: number): number {
  return match.games.filter((g) => g.isComplete && g.gameWinnerId === teamId).length
}

const cards = computed<Card[]>(() =>
  matches.value.map((m) => {
    const [a, b] = m.teams
    const completed = m.games.some((g) => g.isComplete)
    const build = (t?: teamWithMembers): CardTeam => ({
      team: t,
      tag: t?.tag || '—',
      icon: cacheUrl(t?.iconUri),
      wins: t ? winsFor(m, t.teamId) : 0,
      isWinner: t != null && m.winnerId === t.teamId,
    })
    return {
      matchId: m.matchId,
      name: m.name || `Match ${m.matchId}`,
      dotCount: dotsForBestOf(m.type),
      upcoming: !completed,
      left: build(a),
      right: build(b),
    }
  }),
)

const hasData = computed(() => cards.value.length > 0)
</script>

<template>
  <PostGameScreenFrame title="Matchups" subtitle="Series bracket">
    <div v-if="hasData" class="grid">
      <div
        v-for="card in cards"
        :key="card.matchId"
        class="card"
        :class="{ upcoming: card.upcoming }"
      >
        <div class="card-name">{{ card.name }}</div>

        <div class="card-body">
          <!-- left team -->
          <div class="team team-left">
            <div class="team-badge side-blue">
              <img
                v-if="card.left.icon"
                :src="card.left.icon"
                :alt="card.left.tag"
                @error="handleImageError"
                @load="handleImageLoad"
              />
              <span class="badge-fallback">{{ card.left.tag }}</span>
            </div>
            <span class="team-tag" :class="{ winner: card.left.isWinner }">{{
              card.left.tag
            }}</span>
          </div>

          <div class="vs">VS</div>

          <!-- right team -->
          <div class="team team-right">
            <span class="team-tag" :class="{ winner: card.right.isWinner }">{{
              card.right.tag
            }}</span>
            <div class="team-badge side-red">
              <img
                v-if="card.right.icon"
                :src="card.right.icon"
                :alt="card.right.tag"
                @error="handleImageError"
                @load="handleImageLoad"
              />
              <span class="badge-fallback">{{ card.right.tag }}</span>
            </div>
          </div>
        </div>

        <div v-if="card.upcoming" class="upcoming-chip">Upcoming</div>
        <div v-else class="score-row">
          <div class="dots dots-left">
            <span
              v-for="n in card.dotCount"
              :key="`l-${n}`"
              class="dot side-blue"
              :class="{ filled: n <= card.left.wins }"
            />
          </div>
          <div class="dots dots-right">
            <span
              v-for="n in card.dotCount"
              :key="`r-${n}`"
              class="dot side-red"
              :class="{ filled: n <= card.right.wins }"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="pg-empty"><span>No Data</span></div>
  </PostGameScreenFrame>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-content: start;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 28px 30px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}
.card.upcoming {
  border-style: dashed;
  border-color: rgb(255 255 255 / 0.2);
  background: var(--surface-soft);
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.team {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.team-right {
  flex-direction: row;
  justify-content: flex-end;
}

.team-badge {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  overflow: hidden;
}
.team-badge.side-blue {
  background: color-mix(in oklab, var(--blue-team-color) 30%, black);
}
.team-badge.side-red {
  background: color-mix(in oklab, var(--red-team-color) 30%, black);
}
.team-badge img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.badge-fallback {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: white;
}

.team-tag {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: white;
}
.team-tag.winner {
  color: var(--broadcast-accent);
}

.vs {
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: rgb(255 255 255 / 0.35);
}

.score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid rgb(255 255 255 / 0.08);
}

.dots {
  display: flex;
  gap: 8px;
}
.dots-right {
  flex-direction: row-reverse;
}

.dot {
  width: 15px;
  height: 15px;
  border-radius: var(--radius-pill);
  background: rgb(255 255 255 / 0.12);
}
.dot.side-blue.filled {
  background: var(--blue-team-color);
}
.dot.side-red.filled {
  background: var(--red-team-color);
}

.upcoming-chip {
  align-self: flex-start;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.55);
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: var(--radius-pill);
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
