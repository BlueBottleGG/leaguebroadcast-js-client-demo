<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame';
import { Team } from '@bluebottle_gg/league-broadcast-client';
import PlayerCamera from './PlayerCamera.vue';

const scoreboard = useIngameSelector((s) => s.gameData.scoreboardBottom);
const teamfight = useIngameSelector((s) => s.gameData.teamfightDamageOverview);
</script>


<template>
    <Transition name="slide-down">
        <div v-show="scoreboard || teamfight" class="camera-container">
            <PlayerCamera show :team="Team.Order" :scoreboard="scoreboard" :teamfight="teamfight"
                class="border rounded-t-sm border-r-0.5 border-b-0 camera-border" />
            <div></div>
            <PlayerCamera show :team="Team.Chaos" :scoreboard="scoreboard" :teamfight="teamfight"
                class="border rounded-t-sm border-r-0.5 border-b-0 camera-border" />
        </div>
    </Transition>
</template>



<style lang="css" scoped>
.camera-border {
    border-color: var(--border-color);
}

.camera-container {
    display: grid;
    grid-template-columns: 178px 1fr 178px;
    grid-template-rows: 1fr;
}
</style>