<script setup lang="ts">
import { computed } from 'vue'
import {
  IngameObjectiveType,
  Team,
  getRemaining,
  type iObjectiveRespawnData,
  type ingameScoreboardTeamData,
  type teamInhibitorData,
  type teamWithMembers,
} from '@bluebottle_gg/league-broadcast-client'
import { useIngameSelector } from '@/composables/useIngame'
import { useGameClock } from '@/composables/useGameClock'
import TopIcon from '@/assets/lane/top-placeholder-cropped.svg?url'
import MidIcon from '@/assets/lane/mid-placeholder-cropped.svg?url'
import BotIcon from '@/assets/lane/bot-placeholder-cropped.svg?url'

type LaneKey = 'top' | 'mid' | 'bot'

type InhibitorSlot = {
  key: string
  lane: LaneKey
  data: iObjectiveRespawnData
}

type TeamTimerGroup = {
  team: teamInhibitorData
  scoreboardTeam?: ingameScoreboardTeamData
  rosterTeam?: teamWithMembers
  timers: InhibitorSlot[]
}

const inhibitors = useIngameSelector((s) => s.gameData.inhibitors ?? [])
const gameTime = useGameClock()

/**
 * Resolution the timers are read at. The bar crosses its track over a five-minute respawn —
 * well under a pixel a second — and the text only shows whole seconds, so quarter-second
 * steps are everything the display can resolve. Reading through this instead of the raw
 * clock keeps the whole list off the per-frame render path.
 */
const TIMER_RESOLUTION_SECONDS = 0.25
const displayTime = computed(
  () => Math.floor(gameTime.value / TIMER_RESOLUTION_SECONDS) * TIMER_RESOLUTION_SECONDS,
)
const scoreboard = useIngameSelector((s) => s.gameData.scoreboard)
const teams = useIngameSelector((s) => s.gameData.teams ?? [])

function objectiveType(data: iObjectiveRespawnData): IngameObjectiveType {
  return typeof data.type === 'string'
    ? IngameObjectiveType[data.type as keyof typeof IngameObjectiveType]
    : data.type
}

function laneFor(data: iObjectiveRespawnData, fallbackIndex: number): LaneKey {
  switch (objectiveType(data)) {
    case IngameObjectiveType.INHIBITOR_L0:
      return 'bot'
    case IngameObjectiveType.INHIBITOR_L1:
      return 'mid'
    case IngameObjectiveType.INHIBITOR_L2:
      return 'top'
    default:
      return ['bot', 'mid', 'top'][fallbackIndex] as LaneKey
  }
}

function laneRank(lane: LaneKey): number {
  return lane === 'top' ? 0 : lane === 'mid' ? 1 : 2
}

function laneIcon(lane: LaneKey): string {
  return lane === 'top' ? TopIcon : lane === 'mid' ? MidIcon : BotIcon
}

function colorNumberToCss(color?: number): string | undefined {
  if (color === undefined || color === null) return undefined
  const rgb = (color >>> 0) & 0xffffff
  if (rgb === 0) return undefined
  return `#${rgb.toString(16).padStart(6, '0')}`
}

function sideFallbackColor(side: number): string {
  return side === Team.Chaos ? 'var(--red-team-color)' : 'var(--blue-team-color)'
}

function teamColor(group: TeamTimerGroup): string {
  return (
    colorNumberToCss(group.rosterTeam?.primaryColor) ||
    colorNumberToCss(group.rosterTeam?.secondaryColor) ||
    colorNumberToCss(group.rosterTeam?.tertiaryColor) ||
    sideFallbackColor(group.team.side)
  )
}

function isTimerActive(data: iObjectiveRespawnData): boolean {
  return (data.timeAlive ?? 0) > displayTime.value
}

function inhibitorSlots(team: teamInhibitorData): InhibitorSlot[] {
  return Object.entries(team.inhibitors ?? {})
    .map(([key, data], index) => ({ key, lane: laneFor(data, index), data }))
    .sort((a, b) => laneRank(a.lane) - laneRank(b.lane))
}

function scoreboardTeamFor(team: teamInhibitorData): ingameScoreboardTeamData | undefined {
  return scoreboard.value?.teams[team.side - 1]
}

function rosterTeamFor(team: teamInhibitorData): teamWithMembers | undefined {
  return teams.value.find((t) => t.teamId === team.teamid) ?? teams.value[team.side - 1]
}

const groups = computed<TeamTimerGroup[]>(() =>
  inhibitors.value
    .map((team) => ({
      team,
      scoreboardTeam: scoreboardTeamFor(team),
      rosterTeam: rosterTeamFor(team),
      timers: inhibitorSlots(team),
    }))
    .filter((group) => group.timers.some((timer) => isTimerActive(timer.data))),
)

const hasActiveTimers = computed(() => groups.value.length > 0)

function teamTitle(group: TeamTimerGroup): string {
  return (
    group.scoreboardTeam?.teamTag ||
    group.rosterTeam?.tag ||
    group.team.team ||
    group.scoreboardTeam?.teamName ||
    'TEAM'
  )
}

function teamSubtitle(group: TeamTimerGroup): string {
  return group.scoreboardTeam?.infoText || group.rosterTeam?.description || ''
}

function progressWidth(timer: InhibitorSlot): string {
  if (!isTimerActive(timer.data)) return '0%'
  return `${Math.max(
    0,
    Math.min(
      100,
      (getRemaining(timer.data.timeAlive, displayTime.value) /
        Math.max(1, (timer.data.timeAlive ?? displayTime.value) - timer.data.timeDestroy)) *
        100,
    ),
  )}%`
}

function formattedRemaining(timer: InhibitorSlot): string {
  if (!isTimerActive(timer.data)) return '---'
  const remaining = getRemaining(timer.data.timeAlive, displayTime.value)
  const safeRemaining = Math.max(0, remaining)
  const minutes = Math.floor(safeRemaining / 60)
  const seconds = Math.floor(safeRemaining % 60)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

defineExpose({ hasActiveTimers })
</script>

<template>
  <Transition name="inhibitor-timers">
    <div v-if="hasActiveTimers" class="inhibitor-timers" :class="{ 'is-dual': groups.length > 1 }">
      <div
        v-for="group in groups"
        :key="group.team.teamid || group.team.side"
        class="timer-group"
        :style="{ '--team-color': teamColor(group) }"
      >
        <div class="accent"></div>

        <div class="team-block">
          <div class="inhibitor-mark">
            <span></span>
          </div>
          <div class="team-copy">
            <p class="team-name">{{ teamTitle(group) }}</p>
            <p v-if="teamSubtitle(group)" class="team-subtitle">{{ teamSubtitle(group) }}</p>
          </div>
        </div>

        <div class="timer-list">
          <div
            v-for="timer in group.timers"
            :key="timer.key"
            class="timer-row"
            :class="{ 'is-alive': !isTimerActive(timer.data) }"
          >
            <img class="lane-icon" :src="laneIcon(timer.lane)" alt="" />
            <div class="timer-bar">
              <div
                class="timer-fill"
                :style="{
                  width: progressWidth(timer),
                }"
              ></div>
            </div>
            <span class="timer-text">{{ formattedRemaining(timer) }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.inhibitor-timers {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  background: #000;
  color: #fff;
  font-family: 'Bebas Neue', sans-serif;
}

.inhibitor-timers.is-dual {
  gap: 4px;
  padding-block: 5px;
}

.timer-group {
  position: relative;
  --team-color: var(--blue-team-color);
  min-height: 66px;
  display: grid;
  grid-template-columns: minmax(88px, 0.9fr) minmax(92px, 1fr);
  align-items: center;
  column-gap: 9px;
  padding: 4px 2px 4px 12px;
}

.inhibitor-timers.is-dual .timer-group {
  min-height: 52px;
  column-gap: 7px;
  padding-top: 2px;
  padding-bottom: 2px;
}

.accent {
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 4px;
  background: var(--team-color);
}

.team-block {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.inhibitor-mark {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: var(--team-color);
  border: 3px solid currentColor;
  border-radius: 50%;
  box-shadow: 0 0 9px color-mix(in oklab, currentColor 45%, transparent);
}

.inhibitor-mark span {
  width: 11px;
  height: 11px;
  border: 3px solid currentColor;
  transform: rotate(45deg);
}

.inhibitor-timers.is-dual .inhibitor-mark {
  width: 26px;
  height: 26px;
  border-width: 2px;
}

.inhibitor-timers.is-dual .inhibitor-mark span {
  width: 9px;
  height: 9px;
  border-width: 2px;
}

.team-copy {
  min-width: 0;
}

.team-name {
  margin: 0;
  color: #fff;
  font-size: 28px;
  font-weight: 900;
  line-height: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-subtitle {
  margin: 4px 0 0;
  color: #8c8c8c;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inhibitor-timers.is-dual .team-name {
  font-size: 22px;
}

.inhibitor-timers.is-dual .team-subtitle {
  margin-top: 2px;
  font-size: 11px;
}

.timer-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-width: 0;
}

.timer-row {
  display: grid;
  grid-template-columns: 24px minmax(20px, 1fr) 48px;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.timer-row.is-alive {
  opacity: 0.42;
}

.timer-row.is-alive .timer-bar {
  background: color-mix(in oklab, var(--team-color) 18%, rgba(255, 255, 255, 0.16));
}

.inhibitor-timers.is-dual .timer-list {
  gap: 3px;
}

.inhibitor-timers.is-dual .timer-row {
  grid-template-columns: 20px minmax(16px, 1fr) 42px;
  gap: 5px;
}

.lane-icon {
  width: 24px;
  height: 18px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.inhibitor-timers.is-dual .lane-icon {
  width: 20px;
  height: 13px;
}

.timer-bar {
  height: 4px;
  min-width: 0;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--team-color) 30%, rgba(255, 255, 255, 0.18)),
    rgba(255, 255, 255, 0.2)
  );
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.timer-fill {
  height: 100%;
  background: var(--team-color);
  transition: width 0.4s linear;
}

.timer-text {
  color: #fff;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
  text-align: right;
  text-shadow: 0 1px 2px #000;
}

.inhibitor-timers.is-dual .timer-text {
  font-size: 13px;
}

.inhibitor-timers-enter-active,
.inhibitor-timers-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.inhibitor-timers-enter-from,
.inhibitor-timers-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
