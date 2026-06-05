<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame';
import ObjectivePowerPlay from './ObjectivePowerPlay.vue';
import { Team } from '@bluebottle_gg/league-broadcast-client';

const blueBaron = useIngameSelector((s) => s.gameData.scoreboard?.teams[Team.Order - 1]?.baronPowerPlay)
const redBaron = useIngameSelector((s) => s.gameData.scoreboard?.teams[Team.Chaos - 1]?.baronPowerPlay)

const blueDragon = useIngameSelector((s) => s.gameData.scoreboard?.teams[Team.Order - 1]?.dragonPowerPlay)
const redDragon = useIngameSelector((s) => s.gameData.scoreboard?.teams[Team.Chaos - 1]?.dragonPowerPlay)
</script>


<template>
    <div class="powerplay-container">
        <div class="order">
            <ObjectivePowerPlay :team="Team.Order" :type="'baron'" :power-play="blueBaron" />
            <ObjectivePowerPlay :team="Team.Order" :type="'dragon'" :power-play="blueDragon" />
        </div>

        <div class="chaos">
            <ObjectivePowerPlay :team="Team.Chaos" :type="'baron'" :power-play="redBaron" />

            <ObjectivePowerPlay :team="Team.Chaos" :type="'dragon'" :power-play="redDragon" />
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

.order {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    transform: translateX(calc(-50% - 410px));
}

.chaos {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    transform: translateX(calc(50% + 410px));
}
</style>