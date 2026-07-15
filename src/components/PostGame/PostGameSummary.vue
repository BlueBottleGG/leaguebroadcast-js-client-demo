<script setup lang="ts">
import { computed } from 'vue'
import { formatDamage, type postGameTeamOverview } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import Fire from '@/assets/dragon/fire.png'
import Air from '@/assets/dragon/air.png'
import Chemtech from '@/assets/dragon/chemtech.png'
import Hextech from '@/assets/dragon/hextech.png'
import Earth from '@/assets/dragon/earth.png'
import Water from '@/assets/dragon/water.png'
import Elder from '@/assets/dragon/elder.png'

const props = defineProps<{
  blue: postGameTeamOverview
  red: postGameTeamOverview
}>()

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

function dragonIcon(type: string): string | undefined {
  switch (type.toLowerCase()) {
    case 'fire':
      return Fire
    case 'air':
      return Air
    case 'chemtech':
      return Chemtech
    case 'hextech':
      return Hextech
    case 'earth':
      return Earth
    case 'water':
      return Water
    case 'elder':
      return Elder
    default:
      return undefined
  }
}

interface StatRow {
  label: string
  blue: string
  red: string
  blueRaw: number
  redRaw: number
  /** KDA has no single-value winner, so neither side is highlighted. */
  neutral?: boolean
}

const kda = (t: postGameTeamOverview) => `${t.kills}/${t.deaths}/${t.assists}`

// Simple numeric rows rendered above and below the special "Drakes" icon row.
const topRows = computed<StatRow[]>(() => {
  const b = props.blue
  const r = props.red
  return [
    { label: 'KDA', blue: kda(b), red: kda(r), blueRaw: 0, redRaw: 0, neutral: true },
    {
      label: 'Gold',
      blue: formatDamage(b.gold),
      red: formatDamage(r.gold),
      blueRaw: b.gold,
      redRaw: r.gold,
    },
    {
      label: 'Turrets',
      blue: String(b.towers),
      red: String(r.towers),
      blueRaw: b.towers,
      redRaw: r.towers,
    },
  ]
})

const bottomRows = computed<StatRow[]>(() => {
  const b = props.blue
  const r = props.red
  return [
    {
      label: 'Elder Dragons',
      blue: String(b.elderDragons),
      red: String(r.elderDragons),
      blueRaw: b.elderDragons,
      redRaw: r.elderDragons,
    },
    {
      label: 'Barons',
      blue: String(b.baronNashors),
      red: String(r.baronNashors),
      blueRaw: b.baronNashors,
      redRaw: r.baronNashors,
    },
    {
      label: 'Rift Heralds',
      blue: String(b.heralds),
      red: String(r.heralds),
      blueRaw: b.heralds,
      redRaw: r.heralds,
    },
    {
      label: 'Void Grubs',
      blue: String(b.grubs),
      red: String(r.grubs),
      blueRaw: b.grubs,
      redRaw: r.grubs,
    },
  ]
})

const leadBlue = (row: StatRow) => !row.neutral && row.blueRaw > row.redRaw
const leadRed = (row: StatRow) => !row.neutral && row.redRaw > row.blueRaw
</script>

<template>
  <div class="pg-summary">
    <div v-for="row in topRows" :key="row.label" class="stat-row">
      <span class="value value-blue" :class="{ lead: leadBlue(row) }">{{ row.blue }}</span>
      <span class="label">{{ row.label }}</span>
      <span class="value value-red" :class="{ lead: leadRed(row) }">{{ row.red }}</span>
    </div>

    <!-- Drakes — dragon icons from the backend instead of text -->
    <div class="stat-row">
      <div class="value value-blue drakes">
        <div class="drake-icons">
          <img
            v-for="(d, i) in blue.dragons"
            :key="`bd-${i}`"
            class="drake-icon"
            :src="dragonIcon(d)"
            :alt="d"
          />
        </div>
        <span class="drake-count" :class="{ lead: blue.dragons.length > red.dragons.length }">
          {{ blue.dragons.length }}
        </span>
      </div>
      <span class="label">Drakes</span>
      <div class="value value-red drakes">
        <span class="drake-count" :class="{ lead: red.dragons.length > blue.dragons.length }">
          {{ red.dragons.length }}
        </span>
        <div class="drake-icons">
          <img
            v-for="(d, i) in red.dragons"
            :key="`rd-${i}`"
            class="drake-icon"
            :src="dragonIcon(d)"
            :alt="d"
          />
        </div>
      </div>
    </div>

    <div v-for="row in bottomRows" :key="row.label" class="stat-row">
      <span class="value value-blue" :class="{ lead: leadBlue(row) }">{{ row.blue }}</span>
      <span class="label">{{ row.label }}</span>
      <span class="value value-red" :class="{ lead: leadRed(row) }">{{ row.red }}</span>
    </div>

    <!-- Bans -->
    <div class="stat-row bans-row">
      <div class="ban-group">
        <img
          v-for="(ban, i) in blue.bans"
          :key="`bb-${i}`"
          class="ban-icon"
          :src="cacheUrl(ban.squareImg)"
          :alt="ban.name"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </div>
      <span class="label">Ban</span>
      <div class="ban-group ban-group-right">
        <img
          v-for="(ban, i) in red.bans"
          :key="`rb-${i}`"
          class="ban-icon"
          :src="cacheUrl(ban.squareImg)"
          :alt="ban.name"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg-summary {
  display: flex;
  flex-direction: column;
  padding: 4px 30px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.stat-row {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  min-height: 52px;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
}
.stat-row:last-child {
  border-bottom: none;
}

.value {
  font-size: 30px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  font-variant-numeric: tabular-nums;
}
.value-blue {
  text-align: right;
}
.value-red {
  text-align: left;
}

.value.lead,
.drake-count.lead {
  color: var(--broadcast-accent);
}

.label {
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  white-space: nowrap;
}

/* ── Drakes ── */
.drakes {
  display: flex;
  align-items: center;
  gap: 10px;
}
.value-blue.drakes {
  justify-content: flex-end;
}
.value-red.drakes {
  justify-content: flex-start;
}
.drake-icons {
  display: flex;
  align-items: center;
  gap: 3px;
}
.drake-icon {
  height: 26px;
  width: auto;
}
.drake-count {
  font-size: 30px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  font-variant-numeric: tabular-nums;
}

/* ── Bans ── */
.ban-group {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.ban-group-right {
  justify-content: flex-start;
}
.ban-icon {
  width: 34px;
  height: 34px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  filter: grayscale(0.35);
}
</style>
