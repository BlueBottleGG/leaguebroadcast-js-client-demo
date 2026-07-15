<script setup lang="ts">
import Scoreboard from '@/components/Scoreboard/Scoreboard.vue'
import GoldGraph from '@/components/GoldGraph/GoldGraph.vue'
import PlayerScoreboard from '@/components/PlayerScoreboard/PlayerScoreboard.vue'
import ObjectiveTimers from '@/components/ObjectiveTimer/ObjectiveTimers.vue'
import MinimapFrame from '@/components/Minimap/MinimapFrame.vue'
import LFrame from '@/components/LFrame/LFrame.vue'
import SkinDisplay from '@/components/SidePanel/SkinDisplay.vue'
import RuneDisplay from '@/components/SidePanel/RuneDisplay.vue'
import SideInfoPage from '@/components/SideInfoPage/SideInfoPage.vue'
import { Team } from '@bluebottle_gg/league-broadcast-client'
import CompactTeamfight from '@/components/Teamfight/CompactTeamfight.vue'
import TeamfightPanels from '@/components/Teamfight/TeamfightPanels.vue'
import SmiteReaction from '@/components/SmiteReaction/SmiteReaction.vue'
import PlayerCameras from '@/components/PlayerCameras/PlayerCameras.vue'
import KillFeed from '@/components/KillFeed/KillFeed.vue'
import ObjectivePowerPlayContainer from '@/components/ObjectivePowerPlay/ObjectivePowerPlayContainer.vue'
import Announcer from '@/components/Announcer/Announcer.vue'
import DebugBackground from '@/components/Debug/DebugBackground.vue'

// Individual elements have their own pages under /ingame/element/<name> (index: /ingame/elements).
</script>

<template>
  <div class="overlay">
    <DebugBackground />
    <!-- Core features available in all tiers -->
    <Scoreboard class="overlay-scoreboard" />
    <PlayerScoreboard class="overlay-playerscoreboard" />
    <ObjectiveTimers class="overlay-objective-timers" />
    <SideInfoPage class="overlay-side-info" />
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
    <Announcer class="overlay-announcer" />
    <PlayerCameras class="overlay-playercameras" />
    <GoldGraph class="overlay-bottom" />
    <CompactTeamfight class="overlay-teamfight" />
    <TeamfightPanels class="overlay-teamfight-panels" />
  </div>
</template>
