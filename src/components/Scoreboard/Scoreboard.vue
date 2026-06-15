<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useIngameSelector } from "@/composables/useIngame";
import TeamRow from "./TeamRow.vue";
import TeamObjectiveRow from "./TeamObjectiveRow.vue";
import { GameState } from "@bluebottle_gg/league-broadcast-client";
import { useClient } from "@/client";
import { handleImageError, handleImageLoad } from "@/utils/imageUtils";

const scoreboard = useIngameSelector((s) => s.gameData.scoreboard);
const players = useIngameSelector((s) => s.gameData.scoreboardBottom);
const isMocking = useIngameSelector((s) => (s.gameState as number) === GameState.Mocking);
const client = useClient();

const seasonIcon = ref<string | null>(null);

const blue = computed(() => scoreboard.value?.teams[0]);
const red = computed(() => scoreboard.value?.teams[1]);

const bluePlayers = computed(() => players.value?.teams[0]?.players || []);
const redPlayers = computed(() => players.value?.teams[1]?.players || []);

const gameTime = computed(() => {
    if (!scoreboard.value) return "00:00";
    const minutes = Math.floor(scoreboard.value.gameTime / 60);
    const seconds = Math.floor(scoreboard.value.gameTime % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
})

onMounted(async () => {
    seasonIcon.value = await client.api.season.getCurrentSeasonIcon();
})
const dateTimeNowString = new Date().toISOString();
</script>

<template>
    <Transition name="scoreboard" :duration="{ enter: 850, leave: 750 }">
        <div v-if="scoreboard && blue && red" class="scoreboard">
            <div class="row-clip">
                <div class="top-row">
                    <TeamRow style="grid-column: 1;" :team="blue" :best-of="scoreboard.bestOf"
                        :enemy-team-gold="red.gold" />
                    <!-- TODO: remove temporary cache busting -->
                    <img v-if="seasonIcon" :src="client.getCacheUrl(seasonIcon, true) + `?ts=${dateTimeNowString}`"
                        class="center-logo" @error="handleImageError" @load="handleImageLoad" />
                    <TeamRow style="grid-column: 3;" :team="red" :best-of="scoreboard.bestOf"
                        :enemy-team-gold="blue.gold" mirror />
                </div>
            </div>
            <div class="row-clip">
                <div class="bottom-row">
                    <TeamObjectiveRow :team="blue" :players="bluePlayers" :is-mocking="isMocking" />
                    <p class="game-time text-stretch-vertical">{{ gameTime }}
                    </p>
                    <TeamObjectiveRow :team="red" :players="redPlayers" mirror :is-mocking="isMocking" />
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.scoreboard {
    width: 800px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.row-clip {
    overflow: hidden;
}

/* Enter: top row first, bottom row waits for top to finish */
.scoreboard-enter-active .top-row {
    animation: row-slide-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.scoreboard-enter-active .bottom-row {
    animation: row-slide-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.4s both;
}

/* Exit: bottom row first, top row waits for bottom to finish */
.scoreboard-leave-active .top-row {
    animation: row-slide-out 0.35s cubic-bezier(0.55, 0, 0.75, 0.06) 0.35s both;
}

.scoreboard-leave-active .bottom-row {
    animation: row-slide-out 0.35s cubic-bezier(0.55, 0, 0.75, 0.06) both;
}

@keyframes row-slide-in {
    from {
        transform: translateY(-100%);
    }

    to {
        transform: translateY(0);
    }
}

@keyframes row-slide-out {
    from {
        transform: translateY(0);
    }

    to {
        transform: translateY(-100%);
    }
}

.top-row {
    height: 80px;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-sizing: border-box;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr 40px 1fr;
    grid-template-rows: 80px;
}

.team-row {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 12px;
    color: #fff;
}

.team-row.team-blue {
    background-color: rgba(37, 99, 235, 0.8);
    grid-column: 1;
}

.team-row.team-red {
    background-color: rgba(220, 38, 38, 0.8);
    grid-column: 3;
}

.center-logo {
    width: 32px;
    height: 32px;
    justify-self: center;
    align-self: center;
    grid-column: 2;
}

.bottom-row {
    height: 40px;
    background-color: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    display: grid;
    box-sizing: border-box;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr 40px 1fr;
    grid-template-rows: 40px;
}

.game-time {
    margin: 0;
    line-height: 1;
    color: #fff;
    font-size: 24px;
    font-weight: bold;
    justify-self: center;
    align-self: center;
    letter-spacing: var(--tracking-tight);
}

.text-stretch-vertical {
    font-weight: 800;
}
</style>
