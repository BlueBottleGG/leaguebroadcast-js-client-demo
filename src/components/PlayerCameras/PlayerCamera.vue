<script setup lang="ts">
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import {
  ingameDamageGraphData,
  ingameScoreboardBottomData,
  teamMember,
  type Team,
  isPlayerDead,
  getRemaining,
} from '@bluebottle_gg/league-broadcast-client'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useIngameSelector } from '@/composables/useIngame'
import { usePlayerCameraRoster } from '@/composables/usePlayerCameraRoster'
import { useDirectorCameraFocus } from '@/composables/useDirectorCameraFocus'
import VdoNinjaFrame from './VdoNinjaFrame.vue'
import { playerDisplayName } from '@/utils/playerDisplayName'

const props = defineProps<{
  show: boolean
  team: Team
  scoreboard?: ingameScoreboardBottomData
  teamfight?: ingameDamageGraphData
}>()

const client = useClient()
const gameTime = useIngameSelector((s) => s.gameData.gameTime)
const rosters = usePlayerCameraRoster()
const playersOnTeam = computed(() => rosters.value[props.team] ?? [])

const rotationCounter = ref(0)
const rotationInterval = 10000
let intervalId: number | null = null

/** Live connection state per stream, reported by each VdoNinjaFrame. */
const feedConnected = ref<Record<string, boolean>>({})

function isFeedLive(player: teamMember): boolean {
  // Keyed by the stream URL (guaranteed unique per feed) rather than alias#tag, which is not a
  // reliable identity — broadcast/streamer-mode rosters can leave alias/tag blank or duplicated.
  return !!player.videoStreamUrl && feedConnected.value[player.videoStreamUrl] === true
}

/** Configured player portrait, independent of the video feed. */
function portraitFor(player: teamMember): string | null {
  if (player.iconUri) return client.getCacheUrl(player.iconUri) ?? null
  return null
}

/** Shared lane slot chosen by the champion-detail director (null when it has no pick). */
const focusSlot = useDirectorCameraFocus()

/**
 * The single player that the name plate, the portrait and the feed all follow — one source of
 * truth, advanced by one timer, so the name and picture can never drift apart.
 *
 * When the director has a pick AND this box has a live feed for that slot, lock onto it so the two
 * boxes frame the same lane matchup and follow the action. Otherwise fall back to plain time-based
 * rotation over the whole roster, which keeps the portraits cycling reliably regardless of whether
 * any video feed is connected.
 */
const currentPlayer = computed(() => {
  const roster = playersOnTeam.value
  if (roster.length === 0) return null

  const slot = focusSlot.value
  if (slot !== null && slot < roster.length) {
    const focused = roster[slot]
    if (focused && isFeedLive(focused)) return focused
  }

  return roster[rotationCounter.value % roster.length]
})

function isCurrentPlayerDeadCheck(): boolean {
  if (!currentPlayer.value) return false

  const playerName = `${currentPlayer.value.alias}#${currentPlayer.value.tag}`

  const scoreboardTeam = props.scoreboard?.teams[props.team - 1]
  if (scoreboardTeam) {
    const playerInfo = scoreboardTeam.players.find((p) => p.name === playerName)
    return isPlayerDead(playerInfo, gameTime.value)
  }

  const teamfightEntry = props.teamfight?.damageDealt.find(
    (e) => e.team === props.team && e.name === playerName,
  )
  return getRemaining(teamfightEntry?.respawnAt, gameTime.value) > 0
}

const isCurrentPlayerDead = computed(() => isCurrentPlayerDeadCheck())

onMounted(() => {
  intervalId = window.setInterval(() => {
    if (playersOnTeam.value.length > 0) {
      rotationCounter.value++
    }
  }, rotationInterval)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
})
</script>

<template>
  <div
    id="player-scoreboard-camera"
    class="bg-black/30 flex flex-col transition-opacity duration-300"
    :class="show ? 'opacity-100' : 'opacity-0 pointer-events-none'"
  >
    <div class="camera-top-pad rounded-t" aria-hidden="true"></div>
    <div class="camera-video relative overflow-hidden">
      <!-- Portrait layer: one persistent (pre-decoded) element per player, only the current one
           shown. Matched to `currentPlayer` by object identity — the same roster entry the name
           plate reads — so the picture can never point at a different player than the name, and it
           never depends on the (possibly blank/duplicated) alias#tag. Independent of the video
           feeds: the picture is always the reliable base layer. -->
      <template v-for="(player, index) in playersOnTeam" :key="index">
        <img
          v-if="portraitFor(player)"
          v-show="player === currentPlayer"
          :src="portraitFor(player)!"
          :style="{
            filter: `grayscale(${
              player === currentPlayer && isCurrentPlayerDead ? 1 : 0
            }) drop-shadow(0 6px 12px rgb(0 0 0 / 0.45))`,
            transition: 'filter 0.5s ease',
          }"
          alt="Player portrait"
          class="absolute inset-0 w-full h-full object-cover object-top rounded-t z-10"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </template>

      <!-- Video layer: overlays the current player's portrait whenever their feed is actually live;
           otherwise the portrait underneath shows through. Keyed by stream URL and matched by
           object identity for the same reason as the portraits. -->
      <template v-for="player in playersOnTeam" :key="player.videoStreamUrl">
        <VdoNinjaFrame
          v-if="player.videoStreamUrl"
          :src="player.videoStreamUrl"
          :style="{
            opacity: player === currentPlayer && isFeedLive(player) ? 1 : 0,
            zIndex: player === currentPlayer ? 20 : 1,
            transition: 'opacity 0.5s ease',
          }"
          class="absolute inset-0 w-full h-full rounded-t border-0"
          @connected="feedConnected[player.videoStreamUrl] = $event"
        />
      </template>

      <div
        v-if="isCurrentPlayerDead"
        class="absolute inset-0 bg-black/50 z-30 rounded-t pointer-events-none transition-colors duration-500"
      />

      <div
        v-if="playersOnTeam.length === 0"
        class="absolute inset-0 flex items-center justify-center bg-black/30 z-40"
      ></div>
    </div>

    <!-- Name and picture both read straight from `currentPlayer` and switch in the same render, so
         they are always the same player. -->
    <span class="player-name">{{ playerDisplayName(currentPlayer) }}</span>
  </div>
</template>

<style lang="css" scoped>
/* The vertical space freed by the square video becomes a project-accent cap. */
.camera-top-pad {
  flex: 1 1 auto;
  min-height: 8px;
  width: 100%;
  background-color: var(--broadcast-accent);
}

/* Camera feeds and fallback icons are square assets — keep the display
   area square so nothing gets cropped or letterboxed. */
.camera-video {
  width: 100%;
  aspect-ratio: 1 / 1;
  flex: none;
  /* Neutral portrait matte with a restrained project-accent glow. */
  background:
    linear-gradient(to bottom, rgb(129 117 255 / 0.45) 0%, transparent 16%),
    radial-gradient(ellipse 115% 70% at 50% 100%, rgb(129 117 255 / 0.38), transparent 60%),
    radial-gradient(
      ellipse 68% 240% at 50% 50%,
      rgb(196 192 186 / 0.92) 0%,
      rgb(186 182 176 / 0.85) 60%,
      rgb(160 155 148 / 0.08) 100%
    );
}

/* Compact project-accent name plate with white type. */
.player-name {
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  flex: none;
  height: 64px;
  width: 100%;
  background-color: var(--broadcast-accent);
  color: white;
  font-size: 22px;
  line-height: 22px;
  text-align: center;
  font-weight: 800;
  /* Legibility on the accent: a tight shadow to define the glyph edges plus a
     wider soft one for depth — subtle enough to read as lift, not an outline. */
  text-shadow:
    0 1px 2px rgb(0 0 0 / 0.3),
    0 2px 8px rgb(0 0 0 / 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
