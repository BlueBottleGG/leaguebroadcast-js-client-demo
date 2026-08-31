<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { championData, championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import ChampionStage3D from '../ChampionStage3D.vue'
import blueLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import redLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'

const aliases = [
  'Syndra',
  'KSante',
  'Sivir',
  'Kayle',
  'Ahri',
  'Nautilus',
  'Seraphine',
  'Nocturne',
  'LeeSin',
  'Lux',
]
function champion(index: number): championData {
  const alias = aliases[index % aliases.length] ?? 'Ahri'
  return {
    alias,
    name: alias,
    loadingImg: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${alias}_0.jpg`,
  } as championData
}

function team(
  offset: number,
  logo: string,
  name: string,
  tag: string,
  wins: number,
): championSelectTeam {
  return {
    metaData: {
      iconUri: logo,
      name,
      tag,
    },
    scoreMatch: { wins, losses: 0 },
    slots: Array.from({ length: 5 }, (_, index) => ({
      champion: champion(offset + index),
      isActive: false,
    })),
    bans: Array.from({ length: 5 }, (_, index) => ({
      champion: champion(offset + 5 + index),
      isActive: false,
    })),
  } as championSelectTeam
}

const blueTeam = reactive(team(0, blueLogo, 'Violet Ravens Berlin', 'VRB', 2))
const redTeam = reactive(team(5, redLogo, 'Munich Royal Seven', 'MRS', 1))
const stage = ref<{ beginExit: () => void }>()
const previewChampion = champion(9)
const previewSlotIndex = 2
const previewBanChampion = champion(4)
const previewBanIndex = 0

function startPick(): void {
  const slot = redTeam.slots?.[previewSlotIndex]
  if (!slot) return
  slot.champion = undefined
  slot.isActive = true
}

function hoverChampion(): void {
  const slot = redTeam.slots?.[previewSlotIndex]
  if (!slot) return
  slot.isActive = true
  slot.champion = previewChampion
}

function lockChampion(): void {
  const slot = redTeam.slots?.[previewSlotIndex]
  if (!slot) return
  slot.champion = previewChampion
  slot.isActive = false
}

function startBan(): void {
  const ban = blueTeam.bans?.[previewBanIndex]
  if (!ban) return
  ban.champion = undefined
  ban.isActive = true
}

function hoverBan(): void {
  const ban = blueTeam.bans?.[previewBanIndex]
  if (!ban) return
  ban.isActive = true
  ban.champion = previewBanChampion
}

function lockBan(): void {
  const ban = blueTeam.bans?.[previewBanIndex]
  if (!ban) return
  ban.champion = previewBanChampion
  ban.isActive = false
}

startPick()
</script>

<template>
  <main class="stage-preview">
    <ChampionStage3D
      ref="stage"
      :blue-team="blueTeam"
      event-name="Champion Stage Preview"
      :event-logo-url="redLogo"
      :red-team="redTeam"
    />
    <div class="preview-controls">
      <div class="control-group">
        <span>CAMERA</span>
        <button type="button" @click="stage?.beginExit()">Long shot</button>
      </div>
      <div class="control-group">
        <span>RED MID PICK</span>
        <button type="button" @click="startPick">Start</button>
        <button type="button" @click="hoverChampion">Hover</button>
        <button type="button" @click="lockChampion">Lock</button>
      </div>
      <div class="control-group">
        <span>BLUE WALL BAN</span>
        <button type="button" @click="startBan">Start</button>
        <button type="button" @click="hoverBan">Hover</button>
        <button type="button" @click="lockBan">Lock</button>
      </div>
    </div>
    <div class="fearless-guide">FEARLESS BAN BAR — EXISTING 2D LAYER</div>
    <div class="draft-guide">
      <div>BLUE PICKS + BANS — EXISTING 2D</div>
      <div class="brand-guide">T</div>
      <div>RED PICKS + BANS — EXISTING 2D</div>
    </div>
  </main>
</template>

<style scoped>
.stage-preview {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  color: white;
  font-family: Arial, sans-serif;
}

.fearless-guide,
.draft-guide {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}

.preview-controls {
  position: absolute;
  z-index: 3;
  top: 64px;
  right: 24px;
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: rgb(5 6 10 / 0.82);
  backdrop-filter: blur(10px);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-controls span {
  margin-inline: 4px 8px;
  color: rgb(255 255 255 / 0.55);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
}

.preview-controls button {
  padding: 7px 10px;
  border: 1px solid rgb(255 255 255 / 0.18);
  background: rgb(255 255 255 / 0.07);
  color: white;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.preview-controls button:focus-visible {
  outline: 2px solid #ff365f;
  outline-offset: 2px;
}

.fearless-guide {
  top: 0;
  left: 18.75vw;
  right: 18.75vw;
  height: 4.82vh;
  display: grid;
  place-items: center;
  border-bottom: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(5 6 10 / 0.82);
  color: rgb(255 255 255 / 0.4);
  font-size: 12px;
  letter-spacing: 3px;
}

.draft-guide {
  right: 0;
  bottom: 0;
  left: 0;
  height: 29.45vh;
  display: grid;
  grid-template-columns: 1fr 13.54vw 1fr;
  align-items: center;
  padding: 0 3.65vw;
  border-top: 2px solid color-mix(in oklab, var(--broadcast-accent) 50%, transparent);
  background: rgb(2 3 6 / 0.91);
  color: rgb(255 255 255 / 0.3);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
}

.draft-guide > :last-child {
  text-align: right;
}

.brand-guide {
  color: var(--broadcast-accent);
  font-size: 72px;
  font-weight: 900;
  text-align: center;
}
</style>
