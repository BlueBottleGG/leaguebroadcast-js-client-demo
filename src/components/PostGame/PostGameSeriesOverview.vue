<script setup lang="ts">
import { computed } from 'vue'
import {
  formatGameClock,
  type simpleChampionData,
  type matchOverviewTeamSummary,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { useMatchData, useMatchOverview } from '@/composables/usePostGameScreens'
import PostGameScreenFrame from './PostGameScreenFrame.vue'

/**
 * Series overview: one row per game (picks + KDA per side, running series score
 * in the middle). Winner side reads in team colour, loser dim; incomplete games
 * render at reduced opacity with an "Upcoming" marker.
 */
const match = useMatchData()
const overview = useMatchOverview()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

// Blue = teams[0], red = teams[1] (the match fixtures order them this way).
const blueTeam = computed(() => match.value?.teams?.[0])
const redTeam = computed(() => match.value?.teams?.[1])

const bestOfLabel = computed(() => {
  const n = match.value?.type
  return n ? `Best of ${Number(n)}` : ''
})
const matchName = computed(() => match.value?.name || 'Series')

interface Row {
  gameNumber: number
  gameTime: number
  complete: boolean
  bluePicks: simpleChampionData[]
  redPicks: simpleChampionData[]
  blueKda: string
  redKda: string
  blueWon: boolean
  redWon: boolean
  scoreLabel: string
}

function kda(s?: matchOverviewTeamSummary): string {
  if (!s) return '0 / 0 / 0'
  return `${s.kills} / ${s.deaths} / ${s.assists}`
}

const rows = computed<Row[]>(() => {
  const blueId = blueTeam.value?.teamId
  const redId = redTeam.value?.teamId
  const games = overview.value?.games ?? []
  let blueScore = 0
  let redScore = 0
  return games.map((g) => {
    const blue = blueId != null ? g.teamSummaries?.[blueId] : undefined
    const red = redId != null ? g.teamSummaries?.[redId] : undefined
    const blueWon = g.isComplete && g.gameWinnerId === blueId
    const redWon = g.isComplete && g.gameWinnerId === redId
    if (blueWon) blueScore++
    if (redWon) redScore++
    return {
      gameNumber: g.gameNumber,
      gameTime: g.gameTime,
      complete: g.isComplete,
      bluePicks: blue?.picks ?? [],
      redPicks: red?.picks ?? [],
      blueKda: kda(blue),
      redKda: kda(red),
      blueWon,
      redWon,
      scoreLabel: `${blueScore}–${redScore}`,
    }
  })
})

const hasData = computed(() => rows.value.length > 0)
</script>

<template>
  <PostGameScreenFrame :title="matchName" subtitle="Series Overview">
    <template v-if="bestOfLabel" #header-right>
      <span class="bo-chip">{{ bestOfLabel }}</span>
    </template>

    <div class="team-bar">
      <span class="team-name side-blue">{{ blueTeam?.name || 'Blue Side' }}</span>
      <span class="vs">VS</span>
      <span class="team-name side-red">{{ redTeam?.name || 'Red Side' }}</span>
    </div>

    <div v-if="hasData" class="rows">
      <div
        v-for="row in rows"
        :key="row.gameNumber"
        class="game-row"
        :class="{ incomplete: !row.complete }"
      >
        <!-- blue side -->
        <div
          class="side side-blue"
          :class="{ won: row.blueWon, dim: row.complete && !row.blueWon }"
        >
          <div class="picks">
            <img
              v-for="(c, i) in row.bluePicks"
              :key="`b-${i}`"
              class="pick"
              :src="cacheUrl(c.squareImg)"
              :alt="c.name"
              @error="handleImageError"
              @load="handleImageLoad"
            />
          </div>
          <span class="kda">{{ row.blueKda }}</span>
        </div>

        <!-- center -->
        <div class="center">
          <span class="game-label">Game {{ row.gameNumber }}</span>
          <span v-if="row.complete" class="game-clock">{{ formatGameClock(row.gameTime) }}</span>
          <span v-else class="upcoming">Upcoming</span>
          <span class="series-score">{{ row.scoreLabel }}</span>
        </div>

        <!-- red side -->
        <div class="side side-red" :class="{ won: row.redWon, dim: row.complete && !row.redWon }">
          <span class="kda">{{ row.redKda }}</span>
          <div class="picks picks-right">
            <img
              v-for="(c, i) in row.redPicks"
              :key="`r-${i}`"
              class="pick"
              :src="cacheUrl(c.squareImg)"
              :alt="c.name"
              @error="handleImageError"
              @load="handleImageLoad"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="pg-empty"><span>No Data</span></div>
  </PostGameScreenFrame>
</template>

<style scoped>
.bo-chip {
  padding: 8px 18px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: white;
  background: var(--broadcast-accent);
  border-radius: var(--radius-pill);
}

.rows,
.team-bar {
  flex-shrink: 0;
}

.team-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  margin-bottom: 22px;
  padding: 18px 30px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}
.team-name {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.team-name.side-blue {
  color: color-mix(in oklch, var(--blue-team-color) 70%, white);
  text-align: left;
}
.team-name.side-red {
  color: color-mix(in oklch, var(--red-team-color) 70%, white);
  text-align: right;
}
.team-bar .vs {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: rgb(255 255 255 / 0.35);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  padding: 20px 30px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}
.game-row.incomplete {
  opacity: 0.4;
}

.side {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}
.side-red {
  justify-content: flex-end;
}

.picks {
  display: flex;
  gap: 6px;
}

.pick {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}
.side-blue .pick {
  border-bottom: 2px solid var(--blue-team-color);
}
.side-red .pick {
  border-bottom: 2px solid var(--red-team-color);
}

.kda {
  font-size: 24px;
  font-weight: 800;
  color: rgb(255 255 255 / 0.85);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.side.won.side-blue .kda {
  color: color-mix(in oklch, var(--blue-team-color) 75%, white);
}
.side.won.side-red .kda {
  color: color-mix(in oklch, var(--red-team-color) 75%, white);
}
.side.dim .kda {
  color: rgb(255 255 255 / 0.4);
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 150px;
}
.game-label {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: white;
}
.game-clock {
  font-size: 15px;
  font-weight: 500;
  color: rgb(255 255 255 / 0.6);
  font-variant-numeric: tabular-nums;
}
.upcoming {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.5);
}
.series-score {
  margin-top: 4px;
  font-size: 26px;
  font-weight: 900;
  color: var(--broadcast-accent);
  font-variant-numeric: tabular-nums;
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
