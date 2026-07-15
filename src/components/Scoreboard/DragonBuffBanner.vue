<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useIngameSelector } from '@/composables/useIngame'
import Fire from '@/assets/dragon/fire.png'
import Air from '@/assets/dragon/air.png'
import Chemtech from '@/assets/dragon/chemtech.png'
import Hextech from '@/assets/dragon/hextech.png'
import Earth from '@/assets/dragon/earth.png'
import Water from '@/assets/dragon/water.png'
import Elder from '@/assets/dragon/elder.png'

interface DragonInfo {
  name: string
  icon: string
  /** Deep band background color — dark enough for light text (WCAG AA ≥ 4.5:1) */
  band: string
  /** Light per-type tint for the drake name */
  ink: string
  /** Buff description, scaled by how many of this type the killing team holds */
  stats: (stacks: number) => string
}

// Per-stack Dragon Slayer values (wiki.leagueoflegends.com/en-us/Dragon_Slayer)
const DRAGON_INFO: Record<string, DragonInfo> = {
  fire: {
    name: 'Infernal Drake',
    icon: Fire,
    band: '#7e2610',
    ink: '#ffc9b4',
    stats: (s) => `${3 * s}% Attack Damage and Ability Power`,
  },
  earth: {
    name: 'Mountain Drake',
    icon: Earth,
    band: '#6e5322',
    ink: '#ffdf9d',
    stats: (s) => `${5 * s}% Armor and Magic Resistance`,
  },
  water: {
    name: 'Ocean Drake',
    icon: Water,
    band: '#1d4f6d',
    ink: '#c3e6ff',
    stats: (s) => `Restore ${2 * s}% Missing Health every 5 seconds`,
  },
  air: {
    name: 'Cloud Drake',
    icon: Air,
    band: '#3f4d61',
    ink: '#dce7f6',
    stats: (s) => `${5 * s}% Slow Resist and Out-of-Combat Move Speed`,
  },
  hextech: {
    name: 'Hextech Drake',
    icon: Hextech,
    band: '#0d4c60',
    ink: '#a9e9fb',
    stats: (s) => `${5 * s} Ability Haste and ${5 * s}% Attack Speed`,
  },
  chemtech: {
    name: 'Chemtech Drake',
    icon: Chemtech,
    band: '#3e5719',
    ink: '#d5f0a4',
    stats: (s) => `${6 * s}% Tenacity and Heal & Shield Power`,
  },
  elder: {
    name: 'Elder Dragon',
    icon: Elder,
    band: '#23554e',
    ink: '#c8f2ea',
    stats: () => 'Burn enemies and Execute below 20% Health',
  },
}

const NAME_MS = 3200
const STATS_MS = 5600

const active = ref<{ type: string; stacks: number } | null>(null)
const phase = ref<'name' | 'stats'>('name')
let timers: number[] = []

function clearTimers() {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
}

function show(type: string, stacks: number) {
  const key = type.toLowerCase()
  if (!DRAGON_INFO[key]) return
  clearTimers()
  active.value = { type: key, stacks: Math.min(Math.max(stacks, 1), 4) }
  phase.value = 'name'
  timers.push(window.setTimeout(() => (phase.value = 'stats'), NAME_MS))
  timers.push(window.setTimeout(() => (active.value = null), NAME_MS + STATS_MS))
}

onUnmounted(clearTimers)

const info = computed(() => (active.value ? DRAGON_INFO[active.value.type] : undefined))
const statsText = computed(() =>
  active.value && info.value ? info.value.stats(active.value.stacks) : '',
)

// Fire the banner whenever either team's dragon list grows by one.
const blueDragons = useIngameSelector((s) => s.gameData.scoreboard?.teams[0]?.dragons)
const redDragons = useIngameSelector((s) => s.gameData.scoreboard?.teams[1]?.dragons)

function onDragonsChanged(next?: string[], prev?: string[]) {
  // No previous list means we just (re)connected — don't replay old kills.
  if (!next || !prev || next.length <= prev.length) return
  const type = next[next.length - 1]
  if (!type) return
  const stacks = next.filter((d) => d.toLowerCase() === type.toLowerCase()).length
  show(type, stacks)
}

watch(blueDragons, onDragonsChanged)
watch(redDragons, onDragonsChanged)
</script>

<template>
  <div class="banner-clip">
    <Transition name="drake-banner">
      <div
        v-if="active && info"
        class="drake-banner"
        :style="{ '--drake-band': info.band, '--drake-ink': info.ink }"
      >
        <Transition name="drake-text" mode="out-in">
          <div v-if="phase === 'name'" key="name" class="drake-content">
            <img :src="info.icon" class="drake-icon" alt="" />
            <span class="drake-title">{{ info.name }}</span>
            <img :src="info.icon" class="drake-icon" alt="" />
          </div>
          <div v-else key="stats" class="drake-content">
            <span class="drake-stats">{{ statsText }}</span>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.banner-clip {
  overflow: hidden;
  display: flex;
  justify-content: center;
}

.drake-banner {
  position: relative;
  height: 28px;
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Deep band over a dark base so light text stays legible over bright footage */
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in oklab, var(--drake-band) 88%, #05070c) 18%,
    color-mix(in oklab, var(--drake-band) 88%, #05070c) 82%,
    transparent 100%
  );
  color: var(--drake-ink);
  pointer-events: none;
}

/* Hairlines fading out toward the edges */
.drake-banner::before,
.drake-banner::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 8%,
    color-mix(in oklab, var(--drake-ink) 45%, transparent) 30%,
    color-mix(in oklab, var(--drake-ink) 45%, transparent) 70%,
    transparent 92%
  );
}

.drake-banner::before {
  top: 0;
}

.drake-banner::after {
  bottom: 0;
}

/* Banner slides out from under the scoreboard */
.drake-banner-enter-active {
  transition:
    transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    opacity 0.4s ease-out;
}

.drake-banner-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.55, 0, 0.75, 0.06),
    opacity 0.35s ease-in;
}

.drake-banner-enter-from,
.drake-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.drake-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  line-height: 1;
}

/* Crossfade between the drake name and its buff description */
.drake-text-enter-active,
.drake-text-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.drake-text-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.drake-text-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.drake-icon {
  height: 18px;
  width: auto;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.drake-title,
.drake-stats {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
}

.drake-title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 2.5px;
  text-transform: uppercase;
}

.drake-stats {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: #f2f5f7;
}
</style>
