<script setup lang="ts">
import { computed } from 'vue'
import { formatGameClock } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { usePlayerAnalysis } from '@/composables/usePostGameScreens'
import PostGamePlayerIdentity from './PostGamePlayerIdentity.vue'
import PostGameScreenFrame from './PostGameScreenFrame.vue'

/**
 * Player analysis screen: champion identity (left) + runes and item build
 * (right). Perk icons come from `perks.perks[i].iconPath` — first 4 are the
 * primary tree (keystone + 3 minors), next 2 the secondary tree.
 */
const props = defineProps<{
  playerIndex: number
  gameId?: number
}>()

const playerIndexRef = computed(() => props.playerIndex)
const gameIdRef = computed(() => props.gameId)
const data = usePlayerAnalysis(playerIndexRef, gameIdRef)

const side = computed<'blue' | 'red'>(() => (props.playerIndex < 5 ? 'blue' : 'red'))

const client = useClient()
const cacheUrl = (path?: string) => client.getCacheUrl(path)

const perks = computed(() => data.value?.perks.perks ?? [])
const primaryPerks = computed(() => perks.value.slice(0, 4)) // keystone + 3 minors
const secondaryPerks = computed(() => perks.value.slice(4, 6))
const primaryTree = computed(() => data.value?.perks.primary)
const secondaryTree = computed(() => data.value?.perks.secondary)
/**
 * The API does not promise a presentation order. Keep simultaneous purchases
 * stable, but otherwise always tell the build story from earliest to latest.
 */
const items = computed(() =>
  (data.value?.items ?? [])
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => a.item.gameTime - b.item.gameTime || a.originalIndex - b.originalIndex),
)
</script>

<template>
  <PostGameScreenFrame v-if="data" title="Player Analysis" subtitle="Runes & build">
    <div class="pg-player-analysis">
      <div class="analysis-top-row">
        <div class="left">
          <PostGamePlayerIdentity
            :champion="data.champion"
            :display-name="
              playerDisplayName({ displayName: data.displayName, name: data.nameWithTag })
            "
            :team-tag="data.team?.tag"
            :side="side"
          />
        </div>

        <div class="right">
          <!-- RUNES -->
          <section class="panel">
            <h2 class="panel-title">Runes</h2>
            <div class="runes">
              <!-- primary tree -->
              <div class="tree tree-primary">
                <div class="tree-head">
                  <img
                    v-if="primaryTree?.assetPath"
                    class="tree-icon"
                    :src="cacheUrl(primaryTree.assetPath)"
                    :alt="primaryTree.treeName"
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                  <span class="tree-label">{{ primaryTree?.treeName || 'Primary' }}</span>
                </div>
                <div class="perk-list">
                  <div
                    v-for="(p, i) in primaryPerks"
                    :key="`pri-${i}`"
                    class="perk"
                    :class="{ keystone: i === 0 }"
                  >
                    <img
                      :src="cacheUrl(p.iconPath)"
                      :alt="p.name"
                      @error="handleImageError"
                      @load="handleImageLoad"
                    />
                  </div>
                </div>
              </div>

              <div class="tree-divider" />

              <!-- secondary tree -->
              <div class="tree tree-secondary">
                <div class="tree-head">
                  <img
                    v-if="secondaryTree?.assetPath"
                    class="tree-icon"
                    :src="cacheUrl(secondaryTree.assetPath)"
                    :alt="secondaryTree.treeName"
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                  <span class="tree-label">{{ secondaryTree?.treeName || 'Secondary' }}</span>
                </div>
                <div class="perk-list">
                  <div v-for="(p, i) in secondaryPerks" :key="`sec-${i}`" class="perk secondary">
                    <img
                      :src="cacheUrl(p.iconPath)"
                      :alt="p.name"
                      @error="handleImageError"
                      @load="handleImageLoad"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- BUILD -->
      <section class="panel build-panel">
        <div class="build-heading">
          <h2 class="panel-title">Build</h2>
          <span class="build-direction">Purchase order</span>
        </div>
        <div
          class="build"
          :class="{ 'has-sequence': items.length > 1 }"
          :style="{ '--purchase-count': Math.max(items.length, 1) }"
        >
          <div v-for="({ item: it }, i) in items" :key="`it-${it.id}-${i}`" class="item">
            <span class="item-order" aria-hidden="true">{{ i + 1 }}</span>
            <div class="item-tile">
              <img
                :src="cacheUrl(it.assetUrl)"
                :alt="it.name"
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </div>
            <span class="item-time">{{ formatGameClock(it.gameTime) }}</span>
          </div>
        </div>
      </section>
    </div>
  </PostGameScreenFrame>

  <div v-else class="pg-empty">
    <span>No Data</span>
  </div>
</template>

<style scoped>
.pg-player-analysis {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.analysis-top-row {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 46% 1fr;
  gap: 40px;
}

.left {
  position: relative;
  min-width: 0;
}

.right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.panel {
  padding: 28px 32px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.panel-title {
  margin: 0 0 22px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: white;
}

/* ── Runes ── */
.runes {
  display: flex;
  align-items: flex-start;
  gap: 28px;
}

.tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tree-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tree-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.tree-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.6);
}

.perk-list {
  display: flex;
  align-items: center;
  gap: 14px;
}

.perk {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 1px solid rgb(255 255 255 / 0.08);
  display: grid;
  place-items: center;
  overflow: hidden;
}
.perk img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.perk.keystone {
  width: 72px;
  height: 72px;
  border-color: var(--border-color);
  border-width: var(--brand-border-width);
}

.tree-divider {
  align-self: stretch;
  width: 1px;
  background: rgb(255 255 255 / 0.08);
}

/* ── Build ── */
.build {
  --tile-size: 72px;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--purchase-count), minmax(0, 1fr));
  align-items: start;
}

.build.has-sequence::before {
  content: '';
  position: absolute;
  z-index: 0;
  top: calc(var(--tile-size) / 2);
  right: calc(var(--tile-size) / 2);
  left: calc(var(--tile-size) / 2);
  height: 1px;
  background: rgb(255 255 255 / 0.2);
}

.build.has-sequence::after {
  content: '';
  position: absolute;
  z-index: 0;
  top: calc(var(--tile-size) / 2 - 4px);
  right: calc(var(--tile-size) / 2);
  width: 8px;
  height: 8px;
  border-top: 1px solid rgb(255 255 255 / 0.32);
  border-right: 1px solid rgb(255 255 255 / 0.32);
  transform: rotate(45deg);
}

.item {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.item-order {
  position: absolute;
  top: -8px;
  left: calc(50% - 48px);
  width: 20px;
  height: 20px;
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: var(--radius-pill);
  background: var(--surface-strong);
  color: rgb(255 255 255 / 0.55);
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.item-tile {
  width: var(--tile-size);
  height: var(--tile-size);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  border: 1px solid rgb(255 255 255 / 0.16);
  overflow: hidden;
}
.item-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-time {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.55);
  font-variant-numeric: tabular-nums;
}

.build-panel {
  padding: 24px 32px 26px;
}

.build-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24px;
}

.build-heading .panel-title {
  margin-bottom: 18px;
}

.build-direction {
  color: rgb(255 255 255 / 0.45);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* ── Empty ── */
.pg-empty {
  position: absolute;
  inset: 0;
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
