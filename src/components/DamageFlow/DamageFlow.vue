<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import {
  formatDamage,
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { buildDamageFlow, formatDamageFlowScope, hasDamageFlow } from './damageFlowData'
import { DamageFlowView } from './damageFlowTypes'
import DamageFlowSegments from './DamageFlowSegments.vue'

const props = defineProps<{ sponsorLogo?: string; sponsorName?: string; suppressed?: boolean }>()

const client = useClient()
const data = useIngameSelector((state) => state.gameData.damageFlow)
const roster = useIngameSelector((state) => state.gameData.scoreboardBottom)
const visible = computed(() => !props.suppressed && hasDamageFlow(data.value))
const model = shallowRef(buildDamageFlow())
const contentVisible = ref(true)
let pending: typeof model.value | undefined
let wasVisible = false
let selectionKey = ''
let order: NonNullable<Parameters<typeof buildDamageFlow>[2]> = {}

const presentationKey = (frame: typeof model.value) =>
  JSON.stringify([
    frame.view,
    frame.attackingTeam,
    frame.highlightPlayerName,
    frame.scopeLabel,
    frame.showDamageTypes,
    frame.view === DamageFlowView.PlayerSpotlight ? frame.spotlight?.name : null,
    frame.view === DamageFlowView.PlayerSpotlight && frame.spotlightUnavailable,
  ])

function showPending() {
  if (!pending || !visible.value) return
  model.value = pending
  contentVisible.value = true
}

watch(
  [data, roster, visible],
  () => {
    if (!visible.value) {
      pending = undefined
      wasVisible = false
      selectionKey = ''
      order = {}
      return
    }
    const nextKey = JSON.stringify([
      data.value?.view,
      data.value?.attackingTeam,
      data.value?.highlightPlayerName,
      formatDamageFlowScope(data.value),
    ])
    if (nextKey !== selectionKey) order = {}
    selectionKey = nextKey
    const next = buildDamageFlow(data.value, roster.value, order)
    // Lock the reading order and automatic spotlight until the operator changes
    // the presentation. New totals still update, without moving a player's row.
    order = {
      spotlightName: next.spotlight?.name,
      sourceOrder: next.sourceNodes.map((node) => node.name),
      targetOrder:
        next.view === DamageFlowView.PlayerSpotlight
          ? next.spotlightTargets.map((row) => row.target.name)
          : next.targetNodes.map((node) => node.name),
      edgeOrder: next.edges.map((edge) => edge.key),
      receivedOrder: next.recipients.map((row) => row.node.name),
    }
    pending = next
    // Keep the entire outgoing frame intact. While it retracts, feed updates and
    // repeated selections only replace the pending frame; the latest one enters.
    if (!wasVisible) showPending()
    else if (presentationKey(next) !== presentationKey(model.value)) contentVisible.value = false
    else showPending()
    wasVisible = true
  },
  { immediate: true },
)

const viewNames = ['Top damage links', 'Player spotlight', 'Damage received', 'Matchup matrix']
const damageTypes = [
  { label: 'Physical', color: PHYS_COLOR },
  { label: 'Magic', color: MAGIC_COLOR },
  { label: 'True', color: TRUE_COLOR },
  { label: 'Unknown', color: '#74808d' },
]
const displayedTypes = computed(() => {
  if (model.value.view === DamageFlowView.StrongestConnections)
    return model.value.top3.map((edge) => edge.damageTypes)
  if (model.value.view === DamageFlowView.PlayerSpotlight)
    return model.value.spotlightTargets.flatMap((row) => (row.damageTypes ? [row.damageTypes] : []))
  if (model.value.view === DamageFlowView.DamageReceived)
    return model.value.recipients.flatMap((row) => [row.leadingDamageTypes, row.otherDamageTypes])
  return []
})
const hasTypeColors = computed(
  () =>
    model.value.showDamageTypes &&
    displayedTypes.value.some((values) => values.slice(0, 3).some((value) => value > 0)),
)
const hasUnknownType = computed(() => displayedTypes.value.some((values) => values[3] > 0))
const damage = (value: number | null) => (value == null ? '—' : formatDamage(value))
const percent = (value: number | null) => (value == null ? '—' : `${Math.round(value * 100)}%`)
const amount = (value: number | null, max: number) => ({
  '--amount': max > 0 ? Math.min(1, (value ?? 0) / max) : 0,
})
const highlighted = (name: string) => name === model.value.highlightPlayerName
const portrait = (node: { champion?: { squareImg?: string } }) =>
  node.champion?.squareImg ? client.getCacheUrl(node.champion.squareImg) : undefined
const spotlightArt = computed(() => {
  const champion = model.value.spotlight?.champion
  const path = champion?.loadingImg || champion?.splashCenteredImg || champion?.splashImg
  return path ? client.getCacheUrl(path) : undefined
})
const failedSpotlightArt = ref<string>()
const cellColor = (value: number | null) =>
  `color-mix(in srgb, var(--attack-color) ${Math.min(1, (value ?? 0) / model.value.maxEdge) * 85}%, #040508)`
const strongestCell = computed(() =>
  Math.max(0, ...model.value.matrix.flatMap((row) => row.cells.map((cell) => cell.value ?? 0))),
)
const fanPath = (index: number, count: number) => {
  const end = count > 0 ? ((index + 0.5) * 160) / count : 80
  return `M 2 80 C 44 80, 62 ${end}, 110 ${end} M 105 ${end - 3} L 110 ${end} L 105 ${end + 3}`
}
</script>

<template>
  <Transition name="flow-panel" appear>
    <section
      v-if="visible"
      class="damage-flow"
      :class="{
        'is-matrix': model.view === DamageFlowView.MatchupMatrix,
        'is-received': model.view === DamageFlowView.DamageReceived,
        'red-attacks': model.attackingTeam === 2,
        'is-changing': !contentVisible,
      }"
      aria-label="Damage flow"
    >
      <div class="panel-surface" aria-hidden="true" />
      <header class="panel-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>Damage flow</h2>
        <span class="view-name">{{ viewNames[model.view] }}</span>
        <div v-if="hasTypeColors" class="type-legend" aria-label="Damage types">
          <template v-for="(type, index) in damageTypes" :key="type.label">
            <span v-if="index < 3 || hasUnknownType"
              ><i :style="{ background: type.color }" />{{ type.label }}</span
            >
          </template>
        </div>
        <span class="scope-label">{{ model.scopeLabel }}</span>
        <img
          v-if="sponsorLogo"
          class="sponsor-logo"
          :src="sponsorLogo"
          :alt="sponsorName || 'Sponsor'"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </header>

      <Transition name="flow-view" appear @after-leave="showPending">
        <div v-if="contentVisible" class="flow-content">
          <div v-if="model.view === DamageFlowView.StrongestConnections" class="connections">
            <div v-if="model.top3.length === 0" class="empty-state">
              No champion damage in this window
            </div>
            <div
              v-for="(edge, index) in model.top3"
              :key="edge.key"
              class="connection-row"
              :class="{
                highlighted: highlighted(edge.source.name) || highlighted(edge.target.name),
              }"
              :style="{ '--row': index }"
            >
              <span class="rank">{{ index + 1 }}</span>
              <div class="identity source-identity">
                <span class="portrait"
                  ><img
                    v-if="portrait(edge.source)"
                    :src="portrait(edge.source)"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                /></span>
                <span class="player-name" :title="playerDisplayName(edge.source)">{{
                  playerDisplayName(edge.source)
                }}</span>
              </div>
              <div class="connection-measure">
                <div class="connection-values">
                  <span class="connection-value">{{ formatDamage(edge.value) }}</span>
                  <span class="connection-share"
                    >{{ percent(model.total > 0 ? edge.value / model.total : 0) }} of team</span
                  >
                </div>
                <div class="connection-rail" aria-hidden="true">
                  <span class="bar-fill connection-fill" :style="amount(edge.value, model.maxEdge)"
                    ><DamageFlowSegments
                      v-if="hasTypeColors"
                      :values="edge.damageTypes"
                      :total="edge.value"
                  /></span>
                </div>
              </div>
              <div class="identity target-identity">
                <span class="portrait"
                  ><img
                    v-if="portrait(edge.target)"
                    :src="portrait(edge.target)"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                /></span>
                <span class="player-name" :title="playerDisplayName(edge.target)">{{
                  playerDisplayName(edge.target)
                }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="model.view === DamageFlowView.PlayerSpotlight" class="spotlight">
            <div v-if="model.spotlightUnavailable || !model.spotlight" class="empty-state">
              Selected player unavailable
            </div>
            <template v-else>
              <div class="spotlight-source">
                <img
                  v-if="spotlightArt && failedSpotlightArt !== spotlightArt"
                  class="hero-art"
                  :src="spotlightArt"
                  alt=""
                  @error="
                    (event) => {
                      handleImageError(event)
                      failedSpotlightArt = spotlightArt
                    }
                  "
                  @load="handleImageLoad"
                />
                <span v-else class="portrait hero-portrait"
                  ><img
                    v-if="portrait(model.spotlight)"
                    :src="portrait(model.spotlight)"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                /></span>
                <span class="player-name hero-name" :title="playerDisplayName(model.spotlight)">{{
                  playerDisplayName(model.spotlight)
                }}</span>
                <strong class="hero-value">{{ formatDamage(model.spotlight.dealt) }}</strong>
              </div>
              <svg
                class="spotlight-fan"
                viewBox="0 0 112 160"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <circle cx="3" cy="80" r="3" />
                <path
                  v-for="(row, index) in model.spotlightTargets"
                  :key="row.target.name"
                  :d="fanPath(index, model.spotlightTargets.length)"
                  pathLength="1"
                />
              </svg>
              <div class="spotlight-targets">
                <div class="spotlight-head small-label">
                  <span>Damage to</span><span>Player share</span>
                </div>
                <div
                  v-for="(row, index) in model.spotlightTargets"
                  :key="row.target.name"
                  class="spotlight-row"
                  :style="{ '--row': index }"
                >
                  <div class="identity target-identity">
                    <span class="portrait"
                      ><img
                        v-if="portrait(row.target)"
                        :src="portrait(row.target)"
                        alt=""
                        @error="handleImageError"
                        @load="handleImageLoad"
                    /></span>
                    <span class="player-name" :title="playerDisplayName(row.target)">{{
                      playerDisplayName(row.target)
                    }}</span>
                  </div>
                  <div class="bar-track" aria-hidden="true">
                    <span class="bar-fill" :style="amount(row.value, model.spotlightMax)"
                      ><DamageFlowSegments
                        v-if="hasTypeColors"
                        :values="row.damageTypes"
                        :total="row.value"
                    /></span>
                  </div>
                  <span class="damage-value">{{ damage(row.value) }}</span>
                  <span class="share-value">{{ percent(row.share) }}</span>
                </div>
              </div>
            </template>
          </div>

          <div v-else-if="model.view === DamageFlowView.DamageReceived" class="received">
            <div class="received-head small-label">
              <span>Recipient</span><span></span><span></span><span>Biggest source</span>
            </div>
            <div
              v-for="(row, index) in model.recipients"
              :key="row.node.name"
              class="received-row"
              :class="{ highlighted: highlighted(row.node.name) }"
              :style="{ '--row': index }"
            >
              <div class="identity target-identity">
                <span class="portrait"
                  ><img
                    v-if="portrait(row.node)"
                    :src="portrait(row.node)"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                /></span>
                <span class="player-name" :title="playerDisplayName(row.node)">{{
                  playerDisplayName(row.node)
                }}</span>
              </div>
              <div class="bar-track received-track" aria-hidden="true">
                <span class="bar-fill received-fill" :style="amount(row.value, model.maxReceived)">
                  <span class="leading-fill" :style="{ width: `${row.leadingShare * 100}%` }"
                    ><DamageFlowSegments
                      v-if="hasTypeColors"
                      :values="row.leadingDamageTypes"
                      :total="row.leadingValue"
                  /></span>
                  <span class="other-fill"
                    ><DamageFlowSegments
                      v-if="hasTypeColors"
                      :values="row.otherDamageTypes"
                      :total="row.value - row.leadingValue"
                      muted
                  /></span>
                </span>
              </div>
              <span class="damage-value">{{ formatDamage(row.value) }}</span>
              <div class="leading-source">
                <span class="portrait">
                  <img
                    v-if="row.leadingSource && portrait(row.leadingSource)"
                    :src="portrait(row.leadingSource)"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                </span>
                <span class="player-name" :title="playerDisplayName(row.leadingSource)">{{
                  playerDisplayName(row.leadingSource, '—')
                }}</span
                ><span class="share-value">{{ percent(row.leadingShare) }}</span>
              </div>
            </div>
          </div>

          <table v-else class="matrix" aria-label="Damage dealt by each row to each column">
            <thead>
              <tr>
                <th class="matrix-axis">
                  <span class="attack-name">Dealt by ↓</span
                  ><span class="receive-name">Damage to →</span>
                </th>
                <th
                  v-for="target in model.targetNodes"
                  :key="target.name"
                  :class="{ 'selected-axis': highlighted(target.name) }"
                  scope="col"
                >
                  <div class="identity target-identity">
                    <span class="portrait"
                      ><img
                        v-if="portrait(target)"
                        :src="portrait(target)"
                        alt=""
                        @error="handleImageError"
                        @load="handleImageLoad" /></span
                    ><span class="player-name" :title="playerDisplayName(target)">{{
                      playerDisplayName(target)
                    }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in model.matrix"
                :key="row.source.name"
                :style="{ '--row': index }"
              >
                <th scope="row" :class="{ 'selected-axis': highlighted(row.source.name) }">
                  <div class="identity source-identity">
                    <span class="portrait"
                      ><img
                        v-if="portrait(row.source)"
                        :src="portrait(row.source)"
                        alt=""
                        @error="handleImageError"
                        @load="handleImageLoad" /></span
                    ><span class="player-name" :title="playerDisplayName(row.source)">{{
                      playerDisplayName(row.source)
                    }}</span>
                  </div>
                </th>
                <td
                  v-for="cell in row.cells"
                  :key="cell.target.name"
                  :class="{
                    'largest-cell': (cell.value ?? 0) > 0 && cell.value === strongestCell,
                    'selected-cell': highlighted(row.source.name) || highlighted(cell.target.name),
                  }"
                  :aria-label="`${playerDisplayName(row.source)} to ${playerDisplayName(cell.target)}: ${damage(cell.value)}`"
                >
                  <span class="cell-shade" :style="{ background: cellColor(cell.value) }" /><span
                    class="cell-value"
                    >{{ damage(cell.value) }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Transition>

      <footer
        v-if="
          model.view === DamageFlowView.DamageReceived ||
          model.view === DamageFlowView.MatchupMatrix
        "
        class="panel-footer"
      >
        <div v-if="model.view === DamageFlowView.DamageReceived" class="received-legend">
          <span><i class="leading-key" />Biggest source</span
          ><span><i class="others-key" />Other attackers</span>
        </div>
        <div v-else-if="model.view === DamageFlowView.MatchupMatrix" class="matrix-legend">
          <span>0</span><i /><span>{{ formatDamage(model.maxEdge) }}</span
          ><span>Shared scale</span>
        </div>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.damage-flow {
  /* Reserve the matrix's height; only the opaque surface expands. This keeps
     text unscaled and the compact graphic's painted bounds at 998 × 260. */
  height: 350px;
  pointer-events: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: white;
  transform: translateY(0);
  clip-path: inset(0);
  --panel-scale: 0.7428571429;
  --panel-offset: 90px;
  --footer-height: 0px;
  --attack-color: var(--blue-team-color);
  --receive-color: var(--red-team-color);
  --flow-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --flow-exit-ease: cubic-bezier(0.7, 0, 0.84, 0);
}
.panel-surface {
  position: absolute;
  inset: 0;
  background: #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  transform: scaleY(var(--panel-scale));
  transform-origin: bottom;
  transition: transform 420ms var(--flow-ease);
}
.damage-flow.red-attacks {
  --attack-color: var(--red-team-color);
  --receive-color: var(--blue-team-color);
}
.damage-flow.is-matrix {
  --panel-scale: 1;
  --panel-offset: 0px;
}
.damage-flow.is-matrix,
.damage-flow.is-received {
  --footer-height: 23px;
}
.panel-header {
  position: absolute;
  top: var(--brand-border-width);
  left: var(--brand-border-width);
  right: var(--brand-border-width);
  transform: translateY(var(--panel-offset));
  transition: transform 420ms var(--flow-ease);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  height: 46px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #1a1d24;
  border-bottom: var(--brand-border-width) solid var(--border-color);
}
.brand-marker {
  width: 5px;
  height: 22px;
  flex-shrink: 0;
  background: var(--border-color);
}
h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}
.view-name {
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.8);
  white-space: nowrap;
}
.scope-label {
  margin-left: auto;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  white-space: nowrap;
}
.type-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  font-size: 14px;
  font-weight: 700;
}
.type-legend > span {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.type-legend i {
  width: 10px;
  height: 10px;
}
.attack-name {
  color: var(--attack-color);
}
.receive-name {
  color: var(--receive-color);
}
.sponsor-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  margin-left: 6px;
}
.flow-content {
  position: absolute;
  top: calc(var(--panel-offset) + 46px + var(--brand-border-width));
  bottom: calc(var(--footer-height) + var(--brand-border-width));
  left: var(--brand-border-width);
  right: var(--brand-border-width);
  padding: 8px 18px 0;
  clip-path: inset(-3px);
}
.panel-footer {
  position: absolute;
  bottom: var(--brand-border-width);
  left: var(--brand-border-width);
  right: var(--brand-border-width);
  height: 23px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.035em;
  color: rgb(255 255 255 / 0.75);
}
.small-label {
  font-size: 14px;
  line-height: 18px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.7);
}
.identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}
.portrait {
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  overflow: hidden;
  display: block;
  background: #171c24;
  border: 1px solid var(--attack-color);
  border-radius: var(--radius-sm);
}
.target-identity .portrait {
  border-color: var(--receive-color);
}
.portrait img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.player-name {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 800;
  font-size: 16px;
  line-height: 1.15;
  text-transform: uppercase;
}
.damage-value {
  font-size: 21px;
  line-height: 1;
  font-weight: 900;
  text-align: right;
  white-space: nowrap;
}
.share-value {
  font-size: 17px;
  line-height: 1;
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
}
.bar-track {
  position: relative;
  height: 20px;
  min-width: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 0.035);
}
.bar-fill {
  /* Grow the bar without stretching its arrowhead or text. */
  display: block;
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--amount) * 100%);
  background: var(--attack-color);
  transition: width 480ms var(--flow-ease);
}
.highlighted {
  outline: 1px solid var(--border-color);
  outline-offset: 2px;
  background: color-mix(in srgb, var(--border-color) 9%, transparent);
}
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  min-height: 145px;
  align-items: center;
  justify-content: center;
  font-size: 23px;
  font-weight: 800;
}
.connections {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
.connection-row {
  height: 62px;
  display: grid;
  grid-template-columns: 22px 180px minmax(0, 1fr) 177px;
  align-items: center;
  column-gap: 12px;
}
.connection-row + .connection-row {
  border-top: 1px solid rgb(255 255 255 / 0.09);
}
.rank {
  font-size: 23px;
  color: rgb(255 255 255 / 0.6);
  font-weight: 900;
}
.connection-row .portrait {
  width: 36px;
  height: 36px;
}
.connection-row .player-name {
  font-size: 22px;
}
.connection-measure {
  position: relative;
  height: 54px;
  margin-right: 8px;
}
.connection-values {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 12px;
  height: 30px;
}
.connection-value {
  display: block;
  text-align: right;
  font-weight: 900;
  font-size: 26px;
  line-height: 27px;
}
.connection-share {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  color: rgb(255 255 255 / 0.8);
}
.connection-rail {
  position: relative;
  height: 24px;
  background: rgb(255 255 255 / 0.035);
}
.connection-fill {
  --arrow-tip-space: 10px;
  clip-path: polygon(
    0 0,
    max(0px, calc(100% - 10px)) 0,
    100% 50%,
    max(0px, calc(100% - 10px)) 100%,
    0 100%
  );
}
.spotlight {
  display: grid;
  height: 100%;
  grid-template-columns: 160px 72px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}
.spotlight-source {
  position: relative;
  align-self: stretch;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 3px;
  margin: -8px 0 0 -18px;
  padding: 0 12px 12px 18px;
  overflow: hidden;
}
.hero-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
}
.spotlight-source::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(0deg, #040508 0%, rgb(4 5 8 / 0.8) 25%, transparent 75%),
    linear-gradient(90deg, transparent 60%, #040508 100%);
}
.spotlight-source > :not(.hero-art) {
  position: relative;
  z-index: 1;
}
.hero-portrait {
  width: 68px;
  height: 68px;
  margin-bottom: 3px;
}
.hero-name {
  max-width: 100%;
  font-size: 23px;
}
.hero-value {
  font-size: 38px;
  line-height: 1;
}
.spotlight-fan {
  position: relative;
  width: 112px;
  height: 170px;
  align-self: start;
  margin-top: 20px;
  margin-left: -40px;
  fill: var(--attack-color);
  overflow: visible;
}
.spotlight-fan path {
  fill: none;
  stroke: var(--attack-color);
  stroke-width: 1.2;
  stroke-linejoin: round;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 600ms var(--flow-ease);
}
.spotlight-targets {
  align-self: stretch;
  min-width: 0;
}
.spotlight-head {
  display: flex;
  justify-content: space-between;
  height: 20px;
}
.spotlight-row {
  height: 34px;
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 58px 42px;
  gap: 10px;
  align-items: center;
}
.spotlight-row + .spotlight-row {
  border-top: 1px solid rgb(255 255 255 / 0.07);
}
.received-head,
.received-row {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr) 66px 190px;
  gap: 14px;
  align-items: center;
}
.received-head {
  height: 18px;
}
.received-head > :nth-child(3) {
  text-align: right;
}
.received-row {
  height: 32px;
}
.received-row + .received-row {
  border-top: 1px solid rgb(255 255 255 / 0.07);
}
.received-track {
  height: 20px;
}
.received-fill {
  display: flex;
}
.other-fill {
  flex: 1;
  height: 100%;
  border-left: 2px solid #040508;
  background: color-mix(in srgb, var(--attack-color) 63%, #040508);
}
.leading-fill {
  display: block;
  flex-shrink: 0;
  height: 100%;
  background: color-mix(in srgb, var(--attack-color) 80%, white);
}
.leading-source {
  min-width: 0;
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) 42px;
  gap: 8px;
  align-items: center;
}
.leading-source .player-name {
  font-size: 16px;
}
.leading-source .portrait {
  width: 25px;
  height: 25px;
}
.received-legend,
.received-legend > span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.received-legend {
  gap: 16px;
}
.received-legend i {
  width: 11px;
  height: 11px;
}
.leading-key {
  background: #d4dae0;
}
.others-key {
  background: #59626d;
}
.is-matrix .flow-content {
  padding-top: 7px;
}
.matrix {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.matrix th,
.matrix td {
  border: 1px solid rgb(255 255 255 / 0.13);
  padding: 0 10px;
}
.matrix th:first-child {
  width: 158px;
}
.matrix thead th {
  height: 43px;
}
.matrix tbody th,
.matrix tbody td {
  height: 43px;
}
.matrix .portrait {
  width: 27px;
  height: 27px;
}
.matrix .player-name {
  font-size: 16px;
}
.matrix-axis {
  text-align: left;
  font-weight: 800;
  text-transform: uppercase;
  font-size: 14px;
}
.matrix-axis span {
  display: block;
  line-height: 17px;
}
.matrix td {
  position: relative;
  text-align: center;
  font-size: 23px;
  font-weight: 900;
}
.cell-shade {
  position: absolute;
  inset: 0;
  transform-origin: left;
  transform: scaleX(1);
  transition:
    transform 480ms var(--flow-ease),
    background-color 480ms ease;
}
.cell-value {
  position: relative;
}
.matrix .largest-cell .cell-shade {
  outline: 2px solid white;
  outline-offset: -2px;
}
.matrix .selected-cell .cell-shade {
  box-shadow: inset 0 -3px var(--border-color);
}
.matrix .selected-axis {
  background: color-mix(in srgb, var(--border-color) 20%, #040508);
}
.matrix-legend {
  display: flex;
  align-items: center;
  gap: 8px;
}
.matrix-legend i {
  width: 95px;
  height: 7px;
  background: linear-gradient(90deg, #040508, var(--attack-color));
}
.view-name,
.scope-label,
.type-legend,
.panel-footer {
  clip-path: inset(-3px);
  transition:
    transform 200ms var(--flow-ease),
    clip-path 200ms var(--flow-ease);
}
.is-changing :is(.view-name, .scope-label, .type-legend, .panel-footer) {
  transform: translateY(-6px);
  clip-path: inset(0 0 100%);
}
.flow-panel-enter-active {
  transition:
    transform 740ms var(--flow-ease),
    clip-path 380ms var(--flow-ease);
}
.flow-panel-leave-active {
  transition:
    transform 200ms var(--flow-exit-ease) 120ms,
    clip-path 200ms var(--flow-exit-ease) 120ms;
}
.flow-panel-enter-from,
.flow-panel-leave-to {
  transform: translateY(24px);
  clip-path: inset(100% 0 0);
}
.flow-view-enter-active {
  transition: clip-path 620ms var(--flow-ease);
}
.flow-view-enter-from {
  clip-path: inset(0 0 100%);
}
.flow-view-leave-active {
  transition: clip-path 220ms var(--flow-exit-ease);
}
.flow-view-leave-to {
  clip-path: inset(0 100% 0 0);
}
:is(
  .connection-row,
  .spotlight-row,
  .received-row,
  .matrix tbody tr,
  .spotlight-source,
  .empty-state
) {
  transform: translateX(0);
  clip-path: inset(-3px);
}
:is(.flow-panel-enter-active, .flow-view-enter-active)
  :is(
    .connection-row,
    .spotlight-row,
    .received-row,
    .matrix tbody tr,
    .spotlight-source,
    .empty-state
  ) {
  transition:
    transform 380ms var(--flow-ease),
    clip-path 380ms var(--flow-ease);
  transition-delay: calc(50ms + var(--row, 0) * 24ms);
}
:is(.flow-panel-enter-from, .flow-view-enter-from)
  :is(
    .connection-row,
    .spotlight-row,
    .received-row,
    .matrix tbody tr,
    .spotlight-source,
    .empty-state
  ) {
  transform: translateX(-16px);
  clip-path: inset(0 100% 0 0);
}
:is(.flow-panel-enter-active, .flow-view-enter-active) :is(.bar-fill, .cell-shade) {
  transition-delay: calc(120ms + var(--row, 0) * 24ms);
  transition-duration: 400ms;
}
:is(.flow-panel-enter-from, .flow-view-enter-from, .flow-panel-leave-to, .flow-view-leave-to)
  .bar-fill {
  width: 0;
}
:is(.flow-panel-enter-from, .flow-view-enter-from, .flow-panel-leave-to, .flow-view-leave-to)
  .cell-shade {
  transform: scaleX(0);
}
:is(.flow-panel-leave-active, .flow-view-leave-active) .bar-fill {
  transition: width 150ms var(--flow-exit-ease);
}
:is(.flow-panel-leave-active, .flow-view-leave-active) .cell-shade {
  transition: transform 150ms var(--flow-exit-ease);
}
:is(.flow-panel-enter-from, .flow-view-enter-from, .flow-panel-leave-to, .flow-view-leave-to)
  .spotlight-fan
  path {
  stroke-dashoffset: 1;
}
:is(.flow-panel-enter-active, .flow-view-enter-active) .spotlight-fan path {
  transition-duration: 400ms;
  transition-delay: 100ms;
}
:is(.flow-panel-leave-active, .flow-view-leave-active) .spotlight-fan path {
  transition-duration: 140ms;
}
@media (prefers-reduced-motion: reduce) {
  .damage-flow,
  .damage-flow * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
