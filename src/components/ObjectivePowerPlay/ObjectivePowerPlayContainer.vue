<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import ObjectivePowerPlay from './ObjectivePowerPlay.vue'
import { Team } from '@bluebottle_gg/league-broadcast-client'

const blueBaron = useIngameSelector(
  (s) => s.gameData.scoreboard?.teams[Team.Order - 1]?.baronPowerPlay,
)
const redBaron = useIngameSelector(
  (s) => s.gameData.scoreboard?.teams[Team.Chaos - 1]?.baronPowerPlay,
)

const blueDragon = useIngameSelector(
  (s) => s.gameData.scoreboard?.teams[Team.Order - 1]?.dragonPowerPlay,
)
const redDragon = useIngameSelector(
  (s) => s.gameData.scoreboard?.teams[Team.Chaos - 1]?.dragonPowerPlay,
)
</script>

<template>
  <div class="powerplay-container">
    <div class="order">
      <ObjectivePowerPlay :team="Team.Order" :type="'baron'" :power-play="blueBaron" />
      <ObjectivePowerPlay :team="Team.Order" :type="'dragon'" :power-play="blueDragon" />
    </div>

    <div class="chaos">
      <ObjectivePowerPlay :team="Team.Chaos" :type="'baron'" :power-play="redBaron" mirror />

      <ObjectivePowerPlay :team="Team.Chaos" :type="'dragon'" :power-play="redDragon" mirror />
    </div>
  </div>
</template>

<style lang="css" scoped>
.powerplay-container {
  position: absolute;
  top: 10px;
  width: 100%;
  display: flex;
  justify-content: center;
}

/* No flex `gap` here: an inactive baron/dragon slot still renders an (empty)
   card container, and gap would reserve 4px above the visible card — dropping
   e.g. a lone dragon card 4px below the scoreboard. The inter-card spacing
   lives as margin-bottom on the card itself (only present when visible), so
   whichever card shows always sits flush with the scoreboard's top edge. */
.order {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform: translateX(calc(-50% - 450px));
}

.chaos {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  transform: translateX(calc(50% + 450px));
}
</style>
