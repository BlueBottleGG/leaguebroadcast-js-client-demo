<script setup lang="ts">
import { ref } from "vue";
import Scoreboard from "@/components/Scoreboard/Scoreboard.vue";
import GoldGraph from "@/components/GoldGraph/GoldGraph.vue";
import ConnectionStatus from "./components/Debug/ConnectionStatus.vue";
import EventLog from "./components/Debug/EventLog.vue";
import PlayerScoreboard from "./components/PlayerScoreboard/PlayerScoreboard.vue";
import ObjectiveTimer from "./components/ObjectiveTimer/ObjectiveTimer.vue";
import { useIngameSelector } from "./composables/useIngame";
import MinimapFrame from "./components/Minimap/MinimapFrame.vue";
import LFrame from "./components/LFrame/LFrame.vue";
import SkinDisplay from "./components/SidePanel/SkinDisplay.vue";
import { Team } from "@bluebottle_gg/league-broadcast-client";
import CompactTeamfight from "./components/Teamfight/CompactTeamfight.vue";
import SmiteReaction from "./components/SmiteReaction/SmiteReaction.vue";
import PlayerCameras from "./components/PlayerCameras/PlayerCameras.vue";
import KillFeed from "./components/KillFeed/KillFeed.vue";
import ObjectivePowerPlayContainer from "./components/ObjectivePowerPlay/ObjectivePowerPlayContainer.vue";

const debugVisible = ref(true);
const baronTimer = useIngameSelector((state) => state.gameData.baronPitTimer);
const dragonTimer = useIngameSelector((state) => state.gameData.dragonPitTimer);
const gameTime = useIngameSelector((state) => state.gameData.gameTime);
</script>

<template>
  <div class="overlay">

    <!-- Core features available in all tiers -->
    <Scoreboard class="overlay-scoreboard" />
    <PlayerScoreboard class="overlay-playerscoreboard" />
    <div class="overlay-objective-timers">
      <ObjectiveTimer :objective-data="baronTimer" :game-time="gameTime" />
      <ObjectiveTimer :objective-data="dragonTimer" :game-time="gameTime" />
    </div>
    <MinimapFrame class="overlay-minimap" />
    <LFrame class="overlay-lframe" />
    <ObjectivePowerPlayContainer />

    <!-- Basic Tier only features -->
    <SkinDisplay class="overlay-skindisplay" :team="Team.Order" />
    <SkinDisplay class="overlay-skindisplay" :team="Team.Chaos" mirror />
    <SmiteReaction class="overlay-smitereaction" />
    <KillFeed class="overlay-killfeed" />
    <PlayerCameras class="overlay-playercameras" />
    <GoldGraph class="overlay-bottom" />
    <CompactTeamfight class="overlay-teamfight" />


    <!-- Debug panel. Hide me in production! -->
    <!-- <div class="debug-wrapper">
      <button class="debug-toggle" @click="debugVisible = !debugVisible">
        {{ debugVisible ? "<" : ">" }} </button>
          <Transition name="debug-slide">
            <div v-if="debugVisible" class="debug">
              <ConnectionStatus class="debug-connection" />
              <EventLog class="debug-eventlog" />
            </div>
          </Transition>
    </div> -->
  </div>
</template>

<style>
/* Broadcast overlay: transparent, full-viewport, no scrollbars */
@layer base {

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  * {
    --blue-team-color: oklch(0.6231 0.188 259.81);
    --red-team-color: oklch(0.6231 0.188 28.31);
    --baron-color: oklch(0.581767 0.275459 301.0491);
    --elder-color: oklch(0.8741 0.1329 177.69);
    --baron-color-subtle: oklch(0.581767 0.275459 301.0491 / 0.3);
    --elder-color-subtle: oklch(0.8741 0.1329 177.69 / 0.3);
  }
}

html,
body {
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: transparent;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  color: #e2e8f0;
}
</style>

<style scoped>
.overlay {
  position: relative;
  width: 1920px;
  height: 1080px;
}

.overlay-scoreboard {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
}

.overlay-powerplay {
  position: absolute;
  top: 10px;
  left: 50%;
}

.powerplay-order {
  transform: translateX(calc(-100% - 410px));
}

.powerplay-chaos {
  transform: translateX(410px);
}

.overlay-bottom {
  position: absolute;
  bottom: 0px;
  left: 0x;
  width: calc(1920px - 285px);
  height: 260px;
}

.overlay-playerscoreboard {
  position: absolute;
  bottom: 0px;
  /* left: 285px;
  right: 285px; */
  left: calc(285px + 176px);
  right: calc(285px + 176px);
  height: 260px;
}

.overlay-playercameras {
  position: absolute;
  bottom: 0px;
  left: 285px;
  right: 285px;
  height: 260px;
}

.overlay-objective-timers {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 4px;
}

.overlay-minimap {
  position: absolute;
  bottom: 0px;
  right: 0px;
  width: 285px;
  height: 280px;
}

.overlay-lframe {
  position: absolute;
  bottom: 0px;
  left: 0px;
  width: 285px;
  height: 260px;
}

.overlay-teamfight {
  position: absolute;
  bottom: 0px;
  left: calc(285px + 176px);
  right: calc(285px + 176px);
  height: 260px;
}

.overlay-killfeed {
  position: absolute;
  top: 100px;
  right: 0px;
}

.debug-wrapper {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debug-toggle {
  align-self: flex-start;
  padding: 4px 10px;
  font-size: 11px;
  background: rgba(15, 23, 42, 0.75);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, color 0.15s;
}

.debug-toggle:hover {
  background: rgba(30, 41, 59, 0.9);
  color: #e2e8f0;
}

.debug {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* slide-fade transition */
.debug-slide-enter-active,
.debug-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.debug-slide-enter-from,
.debug-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
