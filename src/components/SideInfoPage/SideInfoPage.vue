<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  IngameSideInfoPageType,
  type ingameSideInfoPage,
  type ingameSideInfoPageRow,
} from '@bluebottle_gg/league-broadcast-client'
import { useIngameSelector } from '@/composables/useIngame'
import brandLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import { playerDisplayName } from '@/utils/playerDisplayName'
import SideInfoRow from './SideInfoRow.vue'

const sideInfoPage = useIngameSelector((s) => s.gameData.sideInfoPage)
const displayedPage = ref<ingameSideInfoPage | undefined>(sideInfoPage.value)
const isVisible = ref(!!sideInfoPage.value)

const titleMap: Record<string, string> = {
  'infopage.creepscore.total': 'Total CS',
  'infopage.damage.total': 'DMG Dealt',
  'infopage.experience.total': 'XP + LVL',
  'infopage.gold.total': 'Total Gold',
  'infopage.rolequest.total': 'Role Quest',
  'infopage.towerplating.total': 'Tower Plates',
  'infopage.towerplatings.total': 'Tower Plates',
  'infopage.towerplating': 'Tower Plates',
  'infopage.towerplatings': 'Tower Plates',
}

const typeTitleMap: Partial<Record<IngameSideInfoPageType, string>> = {
  [IngameSideInfoPageType.Gold]: 'Total Gold',
  [IngameSideInfoPageType.Experience]: 'XP + LVL',
  [IngameSideInfoPageType.CreepScore]: 'Total CS',
  [IngameSideInfoPageType.Damage]: 'DMG Dealt',
  [IngameSideInfoPageType.RoleQuest]: 'Role Quest',
  [IngameSideInfoPageType.TowerPlatings]: 'Tower Plates',
}

watch(
  sideInfoPage,
  (next) => {
    if (next && next.players?.length) {
      displayedPage.value = next
      isVisible.value = true
      return
    }
    isVisible.value = false
  },
  { immediate: true },
)

const panelTitle = computed(() => {
  const page = displayedPage.value
  if (!page) return ''
  if (page.title && titleMap[page.title]) return titleMap[page.title]
  if (page.title && !page.title.includes('.')) return page.title
  return typeTitleMap[page.type] ?? page.title ?? 'Info'
})

const sortedPlayers = computed(() => {
  const players = displayedPage.value?.players ?? []
  return [...players].sort(compareRows)
})

function compareRows(a: ingameSideInfoPageRow, b: ingameSideInfoPageRow): number {
  const valueDelta =
    (b.curValue ?? Number.NEGATIVE_INFINITY) - (a.curValue ?? Number.NEGATIVE_INFINITY)
  if (valueDelta !== 0) return valueDelta
  const teamDelta = (a.team ?? 99) - (b.team ?? 99)
  if (teamDelta !== 0) return teamDelta
  return playerDisplayName(a).localeCompare(playerDisplayName(b))
}

function clearAfterLeave() {
  if (!sideInfoPage.value) displayedPage.value = undefined
}
</script>

<template>
  <Transition name="side-info-panel" @after-leave="clearAfterLeave">
    <aside v-if="isVisible && displayedPage" class="side-info-panel">
      <div class="panel-body">
        <header class="panel-header">
          <span class="brand-marker"></span>
          <h2>{{ panelTitle }}</h2>
        </header>

        <TransitionGroup appear name="side-info-list" tag="div" class="player-stack">
          <SideInfoRow
            v-for="(player, index) in sortedPlayers"
            :key="player.playerName || player.displayName || `${player.team}-${index}`"
            :row="player"
            :display="displayedPage.display"
            :rank="index"
            class="player-stack-row"
            :style="{ '--row-delay': `${120 + Math.min(index, 9) * 45}ms` }"
          />
        </TransitionGroup>
      </div>

      <footer class="panel-footer">
        <span>PRESENTED BY </span>
        <img :src="brandLogo" alt="BlueBottle" />
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
.side-info-panel {
  width: 286px;
  color: white;
  font-family: 'Bebas Neue', Arial, sans-serif;
  background: black;
  border: var(--brand-border-width) solid var(--border-color);
  box-shadow: 0 0 18px color-mix(in oklab, var(--broadcast-accent) 32%, transparent);
  overflow: hidden;
}

.panel-body {
  position: relative;
  min-height: 488px;
  padding: 18px 22px 16px;
  overflow: hidden;
  background:
    linear-gradient(
      115deg,
      color-mix(in oklab, var(--broadcast-accent) 17%, transparent),
      transparent 48%
    ),
    linear-gradient(180deg, rgb(255 255 255 / 0.05), transparent 28%), rgb(4 5 8 / 0.92);
}

.panel-body::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 42%;
  z-index: 2;
  background: linear-gradient(
    100deg,
    transparent,
    color-mix(in oklab, var(--broadcast-accent) 18%, transparent 55%),
    transparent
  );
  animation: side-info-sheen 16s ease-in-out infinite;
  pointer-events: none;
}

.panel-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 9px;
  height: 26px;
  margin-bottom: 14px;
}

.brand-marker {
  width: 5px;
  height: 22px;
  background: var(--broadcast-accent);
  box-shadow: 0 0 10px color-mix(in oklab, var(--broadcast-accent) 65%, transparent);
}

h2 {
  margin: 0;
  color: white;
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.player-stack {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.player-stack-row {
  position: relative;
}

.panel-footer {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: black;
  border-top: 3px solid var(--broadcast-accent);
}

.panel-footer span {
  color: rgb(255 255 255 / 0.76);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.panel-footer img {
  width: 92px;
  max-height: 28px;
  object-fit: contain;
}

.side-info-panel-enter-active {
  transition:
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.28s ease;
}

.side-info-panel-leave-active {
  transition:
    transform 0.42s cubic-bezier(0.55, 0, 0.75, 0.06),
    opacity 0.22s ease 0.18s;
}

.side-info-panel-enter-from,
.side-info-panel-leave-to {
  opacity: 0;
  transform: translateX(-110%);
}

.side-info-list-move,
.side-info-list-enter-active,
.side-info-list-leave-active {
  transition:
    transform 0.52s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.28s ease;
}

.side-info-list-enter-active {
  transition-delay: var(--row-delay);
}

.side-info-list-enter-from,
.side-info-list-leave-to {
  opacity: 0;
  transform: translateX(-26px);
}

.side-info-list-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}

@keyframes side-info-sheen {
  0% {
    transform: translateX(-125%) skewX(-18deg);
  }

  22% {
    transform: translateX(340%) skewX(-18deg);
  }

  100% {
    transform: translateX(340%) skewX(-18deg);
  }
}
</style>
