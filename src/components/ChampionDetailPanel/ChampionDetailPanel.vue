<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  ResourceType,
  SpellSlotIndex,
  getRemaining,
  isActive,
  type championDetailData,
  type championRuneStat,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import ProgressBar from '../PlayerScoreboard/ProgressBar.vue'
import StatCell from './StatCell.vue'
import AbilitySlot from './AbilitySlot.vue'
import HealthBar from './HealthBar.vue'
import { useDamageTracker } from './useDamageTracker'

const detail = useIngameSelector((s) => s.gameData.championDetail)
const gameTime = useIngameSelector((s) => s.gameData.gameTime)
// championDetailData carries no XP, so the level-progress bar is sourced from the tab list,
// matched to the shown champion by display name (with a champion-asset fallback).
const tabs = useIngameSelector((s) => s.gameData.tabs)
const client = useClient()
const detailPlayerName = computed(() => playerDisplayName(detail.value))

const damageTracker = useDamageTracker()
watch([detail, gameTime], ([d, t]) => damageTracker.update(d, t), { immediate: true })

// Snap the HP/resource/XP bars instantly (no width transition) for one render whenever the
// shown player changes, so switching cameras doesn't animate from the previous player's values.
const snapBars = ref(false)
let lastPlayerIndex: number | null = null
watch(
  detail,
  (d) => {
    const idx = d?.playerIndex ?? null
    if (idx !== lastPlayerIndex) {
      lastPlayerIndex = idx
      snapBars.value = true
      nextTick(() => {
        requestAnimationFrame(() => {
          snapBars.value = false
        })
      })
    }
  },
  { immediate: true, flush: 'pre' },
)

// championDetailData.respawnAt is `number | null` (game time when respawning; null while alive),
// unlike tabPlayer/scoreboardBottomPlayerData's `number | undefined`, so we use the generic
// readyAt-based primitives instead of isPlayerDead/getRespawnRemaining.
const isDead = computed(() => isActive(detail.value?.respawnAt ?? undefined, gameTime.value))
const respawnRemaining = computed(() => {
  const d = detail.value
  if (!d) return 0
  return Math.ceil(getRemaining(d.respawnAt ?? undefined, gameTime.value))
})

const hpPct = computed(() => {
  const d = detail.value
  if (!d) return 0
  return Math.min(100, Math.max(0, (d.health.current / (d.health.max || 1)) * 100))
})

// Low-HP state only applies while alive; the death overlay takes over visually once dead.
// Recolor only when the champion is *truly* low on absolute HP (< 100), not on a % threshold —
// a tanky champ at 20% can still have plenty of effective HP.
const isLowHp = computed(() => {
  const d = detail.value
  if (!d || isDead.value) return false
  return d.health.current < 100
})

const resourcePct = computed(() => {
  const d = detail.value
  if (!d) return 0
  return Math.min(100, Math.max(0, (d.resource.current / (d.resource.max || 1)) * 100))
})

const xpPct = computed(() => {
  const d = detail.value
  if (!d) return 0
  const players = Object.values(tabs.value ?? {}).flatMap((t) => t?.players ?? [])
  const match = players.find(
    (p) =>
      (d.displayName && p.displayName === d.displayName) ||
      (d.championAssets?.name && p.championAssets?.name === d.championAssets.name),
  )
  const exp = match?.experience
  if (!exp) return 0
  const span = exp.nextLevel - exp.previousLevel
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((exp.current - exp.previousLevel) / span) * 100))
})

const resourceColor = computed(() => {
  // Mirror the player scoreboard exactly: the resource type may arrive as a string, so coerce it
  // to the enum before mapping, and use the same per-type colors.
  const rawType = detail.value?.resource.type
  const resourceType =
    typeof rawType === 'string' ? ResourceType[rawType as keyof typeof ResourceType] : rawType
  switch (resourceType) {
    case ResourceType.mana:
      return '#1d4ed8'
    case ResourceType.energy:
      return '#d6db29'
    case ResourceType.none:
      return 'transparent'
    case ResourceType.shield:
      return '#A9A9A9'
    case ResourceType.battlefury:
    case ResourceType.dragonfury:
    case ResourceType.rage:
    case ResourceType.heat:
    case ResourceType.gnarfury:
    case ResourceType.ferocity:
    case ResourceType.bloodwell:
      return '#bf0000'
    case ResourceType.wind:
      return '#A9A9A9'
    case ResourceType.unknown:
    default:
      return '#1d4ed8'
  }
})

const q = computed(() => detail.value?.abilities[SpellSlotIndex.Q])
const w = computed(() => detail.value?.abilities[SpellSlotIndex.W])
const e = computed(() => detail.value?.abilities[SpellSlotIndex.E])
const r = computed(() => detail.value?.abilities[SpellSlotIndex.R])

const summonerOne = computed(() => detail.value?.summonerSpells[0])
const summonerTwo = computed(() => detail.value?.summonerSpells[1])

const showBounty = computed(() => (detail.value?.shutdownGold ?? 0) > 150)
const formattedBounty = computed(() => {
  const g = detail.value?.shutdownGold ?? 0
  return g.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
})

function fmt(n: number | undefined): string {
  return Math.max(0, Math.round(n ?? 0)).toString()
}

// ---- Player name auto-fit ----
// The player name must never be ellipsized (broadcast requirement — long names like
// "STANKMEISTER" were being cut to "STANKM…"). Instead of clipping, we scale the name's font
// down to fit the width the identity row grants it. The name span is the only shrinkable flex
// item in the row, so clientWidth is the box it was granted and scrollWidth is the full text at
// base size; their ratio yields the fit scale in a single measure-and-set pass.
const nameEl = ref<HTMLSpanElement | null>(null)
const hideChampionName = ref(false)
const NAME_BASE_PX = 16
const NAME_MIN_PX = 9
// If fitting alongside the champion sub-name would squeeze the name below this size, drop the
// sub-name and hand the name that freed width instead of shrinking further.
const DROP_SUBNAME_BELOW_PX = 12

// Scale the name font to fit its current box; returns the size it settled on.
function scaleNameToFit(): number {
  const el = nameEl.value
  if (!el) return NAME_BASE_PX
  el.style.fontSize = NAME_BASE_PX + 'px'
  const avail = el.clientWidth
  const needed = el.scrollWidth
  if (avail > 0 && needed > avail) {
    const size = Math.max(NAME_MIN_PX, Math.floor(NAME_BASE_PX * (avail / needed)))
    el.style.fontSize = size + 'px'
    return size
  }
  return NAME_BASE_PX
}

async function fitName() {
  if (!nameEl.value) return
  // Pass 1: measure with the champion sub-name shown.
  hideChampionName.value = false
  await nextTick()
  const size = scaleNameToFit()
  // Pass 2: on very long names, drop the sub-name and re-fit with the width it frees up.
  // (Both passes complete within Vue's nextTick microtasks, before paint — no visible flicker.)
  if (size < DROP_SUBNAME_BELOW_PX) {
    hideChampionName.value = true
    await nextTick()
    scaleNameToFit()
  }
}

// Re-fit whenever the shown player, their name, or the bounty badge (which competes for the
// row's width) changes.
watch(
  () => [detailPlayerName.value, detail.value?.championAssets?.name, showBounty.value],
  () => fitName(),
  { immediate: true },
)

onMounted(() => {
  fitName()
  // Bebas Neue may still be loading on first paint; refit once its real glyph metrics land.
  document.fonts?.ready.then(() => fitName())
})

function championIcon(d: championDetailData | null | undefined): string {
  return client.getCacheUrl(d?.championAssets?.squareImg)
}

// ---- Rotating bottom row: combat stats <-> rune values ----
// The game lists a champion's perks as keystone + 3 primary + 2 secondary + 3 stat shards.
// We only show the six "major" runes and intentionally drop the trailing stat shards.
const runes = computed<championRuneStat[]>(() => (detail.value?.runes ?? []).slice(0, 6))
const hasRunes = computed(() => runes.value.length > 0)

// Which of the two stat sets the bottom row currently shows. Falls back to combat stats
// whenever the champion has no runes so the row never goes blank.
const activeStatSet = ref<'stats' | 'runes'>('stats')

let rotationTimer: ReturnType<typeof setInterval> | undefined
rotationTimer = setInterval(() => {
  activeStatSet.value = activeStatSet.value === 'stats' && hasRunes.value ? 'runes' : 'stats'
}, 5000)
onUnmounted(() => {
  if (rotationTimer) clearInterval(rotationTimer)
})

// Snap back to combat stats if the runes disappear while they were showing.
watch(hasRunes, (has) => {
  if (!has) activeStatSet.value = 'stats'
})

// Whether the rune set should render right now (only when selected AND runes exist).
const showRunes = computed(() => activeStatSet.value === 'runes' && hasRunes.value)

function runeIcon(rune: championRuneStat): string {
  return client.getCacheUrl(rune.icon)
}
</script>

<template>
  <Transition name="champion-detail-fade">
    <div
      id="champion-detail-panel"
      v-if="detail"
      :class="{ 'is-low-hp': isLowHp, 'is-burst': damageTracker.burstActive.value }"
    >
      <!-- Top: portrait + identity + bars -->
      <div class="top-row">
        <div class="portrait-wrap" :class="{ 'is-dead': isDead }">
          <img class="portrait-img" :src="championIcon(detail)" />
          <span class="level-badge">{{ detail.level }}</span>
          <div v-if="isDead" class="death-overlay">
            <p class="death-timer-text">{{ respawnRemaining }}</p>
          </div>
        </div>

        <div class="identity-and-bars">
          <div class="identity-row">
            <span ref="nameEl" class="display-name">{{ detailPlayerName }}</span>
            <span v-if="!hideChampionName" class="champion-name">{{
              detail.championAssets?.name ?? detail.name
            }}</span>
            <span v-if="showBounty" class="bounty-badge">{{ formattedBounty }}</span>
          </div>

          <div class="bars">
            <div class="bar-row">
              <HealthBar
                class="hp-bar"
                :progress-pct="hpPct"
                :ghost-pct="damageTracker.ghostPct.value"
                :heal-floor-pct="damageTracker.healFloorPct.value"
                :low-hp="isLowHp"
                :no-transition="snapBars"
              />
              <span class="bar-text"
                >{{ fmt(detail.health.current) }} / {{ fmt(detail.health.max) }}</span
              >
            </div>
            <div class="bar-row">
              <ProgressBar
                class="resource-bar"
                :fill-color="resourceColor"
                :progress-pct="resourcePct"
                :no-transition="snapBars"
              />
              <span class="bar-text"
                >{{ fmt(detail.resource.current) }} / {{ fmt(detail.resource.max) }}</span
              >
            </div>
            <div class="bar-row bar-row-xp">
              <ProgressBar
                class="xp-bar"
                fill-color="var(--broadcast-accent)"
                :progress-pct="xpPct"
                :no-transition="snapBars"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Abilities + KDA -->
      <div class="abilities-row">
        <AbilitySlot
          v-for="(ability, idx) in [q, w, e, r]"
          :key="idx"
          :ability="ability"
          show-level
          variant="ability"
          :no-transition="snapBars"
        />
        <AbilitySlot
          v-for="(spell, idx) in [summonerOne, summonerTwo]"
          :key="'s' + idx"
          :ability="spell"
          variant="summoner"
          :no-transition="snapBars"
        />
        <span class="kda">{{ detail.kills }} / {{ detail.deaths }} / {{ detail.assists }}</span>
      </div>

      <!-- Stats — bottom row rotates every 5s between combat stats and rune values -->
      <div class="stat-area">
        <Transition name="stat-swap" mode="out-in">
          <div v-if="showRunes" key="runes" class="stat-grid rune-grid">
            <div v-for="rune in runes" :key="rune.id" class="rune-cell" :title="rune.name">
              <img class="rune-icon" :src="runeIcon(rune)" :alt="rune.name" />
              <span class="stat-value">{{ fmt(rune.value) }}</span>
            </div>
          </div>
          <div v-else key="stats" class="stat-grid">
            <StatCell icon="sword" color="#e08a3c" :value="fmt(detail.stats.attackDamage)" />
            <StatCell icon="sparkle" color="#a267e0" :value="fmt(detail.stats.abilityPower)" />
            <StatCell icon="shield" color="#d4af37" :value="fmt(detail.stats.armor)" />
            <StatCell icon="circle-shield" color="#4f8fe0" :value="fmt(detail.stats.magicResist)" />
            <StatCell
              icon="crossed-swords"
              color="#e0e0e0"
              :value="
                (detail.stats.attackSpeedIsMultiplierOnly ? '×' : '') +
                detail.stats.attackSpeed.toFixed(2)
              "
            />
            <StatCell icon="boot" color="#e0e0e0" :value="fmt(detail.stats.moveSpeed)" />
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
#champion-detail-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 7px;
  /* Solid black, no border — seamlessly fills the LFrame cutout slot. */
  background: #000;
  font-family: 'Bebas Neue', sans-serif;
  color: #f2ead7;
  box-sizing: border-box;
  transition: box-shadow 0.4s ease-out;
}

/* ---------------- Big-burst accent ---------------- */
/* One-shot edge vignette pulse, fired only on sudden large cumulative damage; fades out over 0.4s. */
#champion-detail-panel.is-burst {
  box-shadow: inset 0 0 26px 4px rgba(224, 40, 30, 0.55);
  transition: box-shadow 0.4s ease-out;
}

/* ---------------- Top row ---------------- */
.top-row {
  display: flex;
  gap: 6px;
  min-height: 0;
}

/* ---------------- Portrait ---------------- */
.portrait-wrap {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  aspect-ratio: 1;
  border-radius: 3px;
  overflow: hidden;
  background: #0c0f0d;
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(0, 0, 0, 0.3);
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.4s ease;
}

.portrait-wrap.is-dead .portrait-img {
  filter: grayscale(1) brightness(0.35);
}

.level-badge {
  position: absolute;
  bottom: 1px;
  right: 1px;
  min-width: 14px;
  padding: 0 2px;
  text-align: center;
  background: rgba(10, 12, 10, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  font-size: 10px;
  line-height: 12px;
  color: #f2ead7;
}

.death-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.death-timer-text {
  margin: 0;
  font-size: 24px;
  color: #ff6b6b;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
}

/* ---------------- Identity + bars ---------------- */
.identity-and-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 3px;
  min-width: 0;
}

.identity-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

/* Player name and champion name sit inline on one row. The name font is auto-scaled in JS
   (see fitName) to fit rather than ellipsize; overflow:hidden is only a clip-of-last-resort. */
.display-name {
  font-size: 16px;
  letter-spacing: 0.02em;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  flex-shrink: 1;
}

.champion-name {
  font-size: 12px;
  color: #9aa2ad;
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}

.bounty-badge {
  margin-left: auto;
  padding: 0 5px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  color: #ffffff;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bar-row {
  position: relative;
  height: 12px;
}

/* XP bar is 2/3 the height of the HP/resource bars. */
.bar-row-xp {
  height: 8px;
}

.bar-row :deep(.hp-bar),
.bar-row :deep(.resource-bar),
.bar-row :deep(.xp-bar) {
  display: block;
  height: 100%;
  border-radius: 2px;
  overflow: hidden;
}

.bar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  color: #ffffff;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  pointer-events: none;
  /* Bebas Neue has almost no descender ink but a large descent metric, so flex-centering the
     line box leaves the visible glyphs sitting well above the optical center; padding-top (not
     transform, which would move the box and its content together) shifts the content down to compensate. */
  padding-top: 0.5px;
}

/* ---------------- Abilities + KDA ---------------- */
.abilities-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.abilities-row :deep(.ability-slot) {
  width: 26px;
  height: 26px;
}

/* KDA sits to the right of the spells, using the horizontal room freed up in the identity row. */
.kda {
  margin-left: auto;
  font-size: 17px;
  color: #ffffff;
  white-space: nowrap;
}

/* ---------------- Stats ---------------- */
/* Fixed-height slot that holds the rotating bottom row; the divider lives here so it
   stays put while the two stat sets cross-fade. */
.stat-area {
  position: relative;
  min-height: 16px;
  padding-top: 1px;
  border-top: var(--brand-border-width) solid var(--border-color);
}

/* Compact single row of six cells spanning the panel width. */
.stat-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.stat-grid :deep(.stat-icon) {
  width: 12px;
  height: 12px;
}

.stat-grid :deep(.stat-value),
.stat-grid .stat-value {
  font-size: 12px;
}

/* Rune set: image icon + live value, styled to match the combat-stat cells. */
.rune-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.rune-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.9));
}

.rune-cell .stat-value {
  font-family: 'Bebas Neue', sans-serif;
  color: #f2ead7;
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
  white-space: nowrap;
}

/* Cross-fade between the combat-stat set and the rune set. */
.stat-swap-enter-active,
.stat-swap-leave-active {
  transition: opacity 0.28s ease;
}

.stat-swap-enter-from,
.stat-swap-leave-to {
  opacity: 0;
}

/* ---------------- Transition ---------------- */
.champion-detail-fade-enter-active,
.champion-detail-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.champion-detail-fade-enter-from,
.champion-detail-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
