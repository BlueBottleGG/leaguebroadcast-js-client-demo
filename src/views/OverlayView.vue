<script setup lang="ts">
import { ref } from 'vue'
import ObjectiveDamage from '@/components/ObjectiveDamage/ObjectiveDamage.vue'
import { buildObjectiveDamage } from '@/components/ObjectiveDamage/objectiveDamageData'
import DamageSidebar from '@/components/DamageSidebar/DamageSidebar.vue'
import TwitchSidebar from '@/components/TwitchSidebar/TwitchSidebar.vue'
import {
  buildIncomingDamage,
  buildOutgoingDamage,
} from '@/components/DamageSidebar/damageSidebarData'
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import Scoreboard from '@/components/Scoreboard/Scoreboard.vue'
import GoldGraph from '@/components/GoldGraph/GoldGraph.vue'
import GoldEfficiency from '@/components/GoldEfficiency/GoldEfficiency.vue'
import { hasGoldEfficiency } from '@/components/GoldEfficiency/goldEfficiencyRows'
import DamageComposition from '@/components/DamageComposition/DamageComposition.vue'
import { hasDamageComposition } from '@/components/DamageComposition/damageCompositionData'
import KillParticipation from '@/components/KillParticipation/KillParticipation.vue'
import { hasKillParticipation } from '@/components/KillParticipation/killParticipationData'
import DamageFlow from '@/components/DamageFlow/DamageFlow.vue'
import { hasDamageFlow } from '@/components/DamageFlow/damageFlowData'
import ObjectiveRecap from '@/components/ObjectiveRecap/ObjectiveRecap.vue'
import { hasObjectiveRecap } from '@/components/ObjectiveRecap/objectiveRecapData'
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
import { useIngameSelector } from '@/composables/useIngame'

const showGoldEfficiency = useIngameSelector((state) =>
  hasGoldEfficiency(state.gameData.goldEfficiency?.players),
)
const showDamageComposition = useIngameSelector((state) =>
  hasDamageComposition(state.gameData.damageComposition),
)
const showDamageFlow = useIngameSelector((state) => hasDamageFlow(state.gameData.damageFlow))

withDefaults(
  defineProps<{
    /** The combined scene owns its background below every phase layer. */
    showDebugBackground?: boolean
  }>(),
  { showDebugBackground: true },
)

const killParticipationVisible = useIngameSelector(
  (state) =>
    hasKillParticipation(state.gameData.killParticipation) &&
    !(
      state.gameData.teamfightDamageOverview?.damageDealt?.length ||
      state.gameData.teamfightTimeline?.players?.length ||
      state.gameData.damageGraph?.damageDealt?.length
    ),
)

const objectiveRecapVisible = useIngameSelector((state) =>
  hasObjectiveRecap(state.gameData.damageRecap),
)

const damageSidebarVisible = useIngameSelector((state) =>
  Boolean(
    buildIncomingDamage(state.gameData.damageRecap) ||
    buildOutgoingDamage(state.gameData.damageSplit),
  ),
)
const sidebarOccupied = ref(false)
const twitchOccupied = ref(false)
const objectiveSidebarOccupied = ref(false)
const objectiveDamageVisible = useIngameSelector(
  (state) => !!buildObjectiveDamage(state.gameData.objectiveDps),
)

// Individual elements have their own pages under /ingame/element/<name> (index: /ingame/elements).
</script>

<template>
  <div class="overlay">
    <DebugBackground v-if="showDebugBackground" />
    <!-- Core features available in all tiers -->
    <Scoreboard class="overlay-scoreboard" />
    <PlayerScoreboard class="overlay-playerscoreboard" />
    <ObjectiveTimers class="overlay-objective-timers" />
    <SideInfoPage
      v-if="
        !twitchOccupied &&
        !objectiveDamageVisible &&
        !objectiveSidebarOccupied &&
        !damageSidebarVisible &&
        !sidebarOccupied
      "
      class="overlay-side-info"
    />
    <DamageSidebar
      :suppressed="twitchOccupied || objectiveDamageVisible || objectiveSidebarOccupied"
      class="overlay-side-info"
      :footer-logo="leagueBroadcastLogo"
      footer-name="League Broadcast"
      @occupancy="sidebarOccupied = $event"
    />
    <ObjectiveDamage
      class="overlay-side-info"
      :suppressed="twitchOccupied || sidebarOccupied"
      @occupancy="objectiveSidebarOccupied = $event"
    />
    <TwitchSidebar class="overlay-twitch-sidebar" @occupancy="twitchOccupied = $event" />
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
    <!-- <PlayerCameras class="overlay-playercameras" /> -->
    <!-- Recap / teamfight and Damage Flow take priority over KP; KP takes over the other charts. -->
    <GoldGraph
      v-if="
        !objectiveRecapVisible &&
        !showDamageFlow &&
        !showDamageComposition &&
        !killParticipationVisible &&
        !showGoldEfficiency
      "
      class="overlay-player-scoreboard-gold-graph"
      variant="player-scoreboard"
    />
    <GoldEfficiency
      v-if="
        !objectiveRecapVisible &&
        !showDamageFlow &&
        !showDamageComposition &&
        !killParticipationVisible
      "
      class="overlay-teamfight-panels"
    />
    <DamageComposition
      v-if="!objectiveRecapVisible && !showDamageFlow && !killParticipationVisible"
      class="overlay-teamfight-panels"
    />
    <DamageFlow :suppressed="objectiveRecapVisible" class="overlay-teamfight-panels" />
    <KillParticipation
      :suppressed="objectiveRecapVisible || showDamageFlow || !killParticipationVisible"
      class="overlay-teamfight-panels"
    />
    <ObjectiveRecap class="overlay-teamfight-panels" />
    <CompactTeamfight v-if="!objectiveRecapVisible" class="overlay-teamfight" />
    <TeamfightPanels v-if="!objectiveRecapVisible" class="overlay-teamfight-panels" />
  </div>
</template>
