<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import {
  buildKillParticipation,
  hasKillParticipation,
  type ParticipationPlayer,
} from './killParticipationData'

const props = defineProps<{ sponsorLogo?: string; sponsorName?: string; suppressed?: boolean }>()
const client = useClient()
const data = useIngameSelector((state) => state.gameData.killParticipation)
const roster = useIngameSelector((state) => state.gameData.scoreboardBottom)
const scoreboard = useIngameSelector((state) => state.gameData.scoreboard)
const visible = computed(() => !props.suppressed && hasKillParticipation(data.value))
const frame = shallowRef({ ...buildKillParticipation(), names: ['Blue team', 'Red team'] })

// Keep the outgoing values/portraits intact while the panel retracts.
watch(
  [data, roster, scoreboard, visible],
  () => {
    if (!visible.value) return
    frame.value = {
      ...buildKillParticipation(data.value, roster.value),
      names: ['Blue team', 'Red team'].map(
        (fallback, side) =>
          scoreboard.value?.teams[side]?.teamName ||
          roster.value?.teams[side]?.name ||
          scoreboard.value?.teams[side]?.teamTag ||
          fallback,
      ),
    }
  },
  { immediate: true },
)

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const reducedMotion = ref(motionQuery.matches)
const elapsed = ref(620)
let animationFrame = 0

function finishCountUp() {
  cancelAnimationFrame(animationFrame)
  elapsed.value = 620
}

function prepareCountUp() {
  finishCountUp()
  elapsed.value = reducedMotion.value ? 620 : 0
}

function startCountUp() {
  if (reducedMotion.value) return
  const start = performance.now()
  const tick = (now: number) => {
    elapsed.value = Math.min(now - start, 620)
    if (elapsed.value < 620) animationFrame = requestAnimationFrame(tick)
  }
  animationFrame = requestAnimationFrame(tick)
}

function onMotionChange() {
  reducedMotion.value = motionQuery.matches
  if (reducedMotion.value) finishCountUp()
}
motionQuery.addEventListener('change', onMotionChange)
onUnmounted(() => {
  finishCountUp()
  motionQuery.removeEventListener('change', onMotionChange)
})

const count = (value: number | null | undefined, delay = 0) => {
  if (value == null) return '—'
  const progress = Math.max(0, Math.min((elapsed.value - delay) / 300, 1))
  return String(Math.round(value * (1 - (1 - progress) ** 3)))
}
const percent = (player?: ParticipationPlayer, delay = 0) =>
  player?.participation == null ? '—' : count(player.participation * 100, delay) + '%'
const portrait = (player?: ParticipationPlayer) =>
  player?.champion?.squareImg ? client.getCacheUrl(player.champion.squareImg) : undefined
</script>

<template>
  <Transition
    name="participation"
    appear
    :duration="{ enter: reducedMotion ? 0 : 620, leave: reducedMotion ? 0 : 250 }"
    @before-enter="prepareCountUp"
    @enter="startCountUp"
    @before-leave="finishCountUp"
    @enter-cancelled="finishCountUp"
  >
    <section
      v-if="visible"
      class="participation-panel"
      aria-label="Kill participation and best duos"
    >
      <header class="panel-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>Kill participation</h2>
        <span class="definition">(K + A) / team kills</span>
        <img
          v-if="sponsorLogo"
          class="sponsor-logo"
          :src="sponsorLogo"
          :alt="sponsorName || 'Sponsor'"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </header>

      <div class="comparison">
        <section
          v-for="(team, side) in frame.teams"
          :key="team.team"
          class="team"
          :class="{ red: team.team === 2 }"
          :aria-label="frame.names[side]"
        >
          <header class="team-heading">
            <span class="team-name" :title="frame.names[side]">{{ frame.names[side] }}</span>
            <span class="team-kills">· {{ count(team.kills, 40) }} kills</span>
          </header>

          <div class="roster">
            <div v-for="index in 5" :key="index" class="player-row" :style="{ '--row': index - 1 }">
              <div class="identity">
                <span class="portrait" aria-hidden="true">
                  <img
                    v-if="portrait(team.players[index - 1])"
                    :src="portrait(team.players[index - 1])"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                </span>
                <span class="player-name" :title="playerDisplayName(team.players[index - 1])">
                  {{ playerDisplayName(team.players[index - 1], '—') }}
                </span>
              </div>
              <span class="kda" aria-label="Kills / deaths / assists">
                {{ count(team.players[index - 1]?.kills, 80 + (index - 1) * 32) }}/{{
                  count(team.players[index - 1]?.deaths, 80 + (index - 1) * 32)
                }}/{{ count(team.players[index - 1]?.assists, 80 + (index - 1) * 32) }}
              </span>
              <span class="bar-track" aria-hidden="true">
                <span
                  class="bar-fill"
                  :style="{ '--amount': team.players[index - 1]?.participation ?? 0 }"
                />
              </span>
              <span class="participation-value">{{
                percent(team.players[index - 1], 80 + (index - 1) * 32)
              }}</span>
            </div>
          </div>

          <footer class="duo">
            <span class="duo-title">Best duo</span>
            <template v-if="team.bestDuo">
              <div
                v-for="role in ['killer', 'assister'] as const"
                :key="role"
                class="identity duo-player"
              >
                <span class="portrait" aria-hidden="true">
                  <img
                    v-if="portrait(team.bestDuo[role])"
                    :src="portrait(team.bestDuo[role])"
                    alt=""
                    @error="handleImageError"
                    @load="handleImageLoad"
                  />
                </span>
                <span class="duo-name">
                  <span class="player-name" :title="playerDisplayName(team.bestDuo[role])">
                    {{ playerDisplayName(team.bestDuo[role]) }}
                  </span>
                  <span class="role">{{ role }}</span>
                </span>
              </div>
              <span class="duo-count">
                <strong>{{ count(team.bestDuo.count, 310) }}</strong>
                <span>Assisted<br />kills</span>
              </span>
            </template>
            <span v-else class="duo-empty">No duo recorded</span>
          </footer>
        </section>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
/* Same panel, identity and bar treatment as DamageFlow; skin supplied by tokens. */
.participation-panel {
  height: 260px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: white;
  background: #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  --participation-ease: cubic-bezier(0.16, 1, 0.3, 1);
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  flex-shrink: 0;
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
.definition {
  color: rgb(255 255 255 / 0.8);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}
.sponsor-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  margin-left: auto;
}
.comparison {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.team {
  --team-color: var(--blue-team-color);
  min-width: 0;
  display: grid;
  grid-template-rows: 23px minmax(0, 1fr) 41px;
}
.team.red {
  --team-color: var(--red-team-color);
  border-left: 1px solid rgb(255 255 255 / 0.2);
}
.team-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 14px;
  font-size: 16px;
  line-height: 1;
  font-weight: 800;
  text-transform: uppercase;
}
.team-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--team-color);
}
.team-kills {
  flex-shrink: 0;
  color: rgb(255 255 255 / 0.72);
  font-size: 13px;
}
.roster {
  min-height: 0;
  padding: 0 14px;
  display: grid;
  grid-template-rows: repeat(5, minmax(0, 1fr));
}
.player-row {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 130px 60px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 8px;
  border-top: 1px solid rgb(255 255 255 / 0.08);
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
  border: 1px solid var(--team-color);
  border-radius: var(--radius-sm);
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
.kda {
  font-size: 13px;
  color: rgb(255 255 255 / 0.75);
  white-space: nowrap;
  text-align: center;
}
.bar-track {
  display: block;
  height: 20px;
  min-width: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 0.035);
}
.bar-fill {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--team-color);
  transform: scaleX(var(--amount));
  transform-origin: left;
  transition: transform 480ms var(--participation-ease);
}
.participation-value {
  font-size: 21px;
  line-height: 1;
  font-weight: 900;
  text-align: right;
  white-space: nowrap;
}
.duo {
  display: grid;
  grid-template-columns: max-content repeat(2, minmax(0, 1fr)) max-content;
  align-items: center;
  column-gap: 10px;
  min-width: 0;
  padding: 0 14px;
  border-top: var(--brand-border-width) solid var(--border-color);
}
.duo-title {
  color: var(--border-color);
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}
.duo-name {
  min-width: 0;
}
.role {
  display: block;
  font-size: 10px;
  line-height: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.7);
}
.duo-count {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px;
  border-left: 1px solid rgb(255 255 255 / 0.3);
}
.duo-count strong {
  font-size: 26px;
  line-height: 1;
  font-weight: 900;
}
.duo-count > span {
  font-size: 10px;
  line-height: 12px;
  font-weight: 700;
  color: rgb(255 255 255 / 0.75);
  text-transform: uppercase;
}
.duo-empty {
  grid-column: 2 / -1;
  font-size: 13px;
  color: rgb(255 255 255 / 0.7);
}
.participation-enter-active,
.participation-leave-active {
  transition:
    transform 400ms var(--participation-ease),
    opacity 250ms ease;
}
.participation-enter-from,
.participation-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.participation-leave-active {
  transition-duration: 250ms;
}
.participation-enter-active .panel-header > *,
.participation-enter-active .team-heading,
.participation-enter-active .player-row,
.participation-enter-active .duo > * {
  transition:
    transform 300ms var(--participation-ease),
    opacity 220ms ease;
  transition-delay: 40ms;
}
.participation-enter-active .player-row {
  transition-delay: calc(80ms + var(--row) * 32ms);
}
.participation-enter-active .duo > * {
  transition-delay: 220ms;
}
.participation-enter-active .duo > :nth-child(2) {
  transition-delay: 250ms;
}
.participation-enter-active .duo > :nth-child(3) {
  transition-delay: 280ms;
}
.participation-enter-active .duo > :nth-child(4) {
  transition-delay: 310ms;
}
.participation-enter-from .panel-header > *,
.participation-enter-from .team-heading,
.participation-enter-from .duo > * {
  transform: translateY(8px);
  opacity: 0;
}
.participation-enter-from .player-row {
  transform: translateX(-12px);
  opacity: 0;
}
.participation-enter-from .red .player-row {
  transform: translateX(12px);
}
.participation-enter-active .bar-fill {
  transition-duration: 340ms;
  transition-delay: calc(100ms + var(--row) * 32ms);
}
.participation-enter-from .bar-fill {
  transform: scaleX(0);
}
@media (prefers-reduced-motion: reduce) {
  .participation-panel,
  .participation-panel * {
    transition: none !important;
  }
}
</style>
