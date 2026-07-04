<script setup lang="ts">
import Scoreboard from '@/components/Scoreboard/Scoreboard.vue'
import GoldGraph from '@/components/GoldGraph/GoldGraph.vue'
import PlayerScoreboard from '@/components/PlayerScoreboard/PlayerScoreboard.vue'
import ObjectiveTimer from '@/components/ObjectiveTimer/ObjectiveTimer.vue'
import { useIngameSelector } from '@/composables/useIngame'
import MinimapFrame from '@/components/Minimap/MinimapFrame.vue'
import LFrame from '@/components/LFrame/LFrame.vue'
import SkinDisplay from '@/components/SidePanel/SkinDisplay.vue'
import RuneDisplay from '@/components/SidePanel/RuneDisplay.vue'
import { Team } from '@bluebottle_gg/league-broadcast-client'
import CompactTeamfight from '@/components/Teamfight/CompactTeamfight.vue'
import SmiteReaction from '@/components/SmiteReaction/SmiteReaction.vue'
import PlayerCameras from '@/components/PlayerCameras/PlayerCameras.vue'
import KillFeed from '@/components/KillFeed/KillFeed.vue'
import ObjectivePowerPlayContainer from '@/components/ObjectivePowerPlay/ObjectivePowerPlayContainer.vue'

const baronTimer = useIngameSelector((state) => state.gameData.baronPitTimer)
const dragonTimer = useIngameSelector((state) => state.gameData.dragonPitTimer)
const gameTime = useIngameSelector((state) => state.gameData.gameTime)
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
    <RuneDisplay class="overlay-skindisplay" :team="Team.Order" />
    <RuneDisplay class="overlay-skindisplay" :team="Team.Chaos" mirror />
    <SmiteReaction class="overlay-smitereaction" />
    <KillFeed class="overlay-killfeed" />
    <PlayerCameras class="overlay-playercameras" />
    <GoldGraph class="overlay-bottom" />
    <CompactTeamfight class="overlay-teamfight" />
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
}

.overlay-scoreboard {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
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
</style>
