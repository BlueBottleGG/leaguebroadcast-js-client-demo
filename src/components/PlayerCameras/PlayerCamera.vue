<script setup lang="ts">
import { useClient } from '@/client';
import { handleImageError, handleImageLoad } from '@/utils/imageUtils';
import { ingameDamageGraphData, ingameScoreboardBottomData, teamMember, type Team, isPlayerDead, getRemaining } from '@bluebottle_gg/league-broadcast-client';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useIngameSelector } from '@/composables/useIngame';

const props = defineProps<{
    show: boolean
    team: Team
    scoreboard?: ingameScoreboardBottomData
    teamfight?: ingameDamageGraphData
}>()

const client = useClient();
const gameTime = useIngameSelector((s) => s.gameData.gameTime);
const playersOnTeam = ref<teamMember[]>([]);

//rotate through players in x seconds intervals.
const currentPlayerIndex = ref(0);
const rotationInterval = 10000; // Rotate every 10 seconds
let intervalId: number | null = null;

function isPlayerDeadByIndex(index: number): boolean {
    const player = playersOnTeam.value[index];
    if (!player) return false;

    const playerName = `${player.alias}#${player.tag}`;

    const scoreboardTeam = props.scoreboard?.teams[props.team - 1];
    if (scoreboardTeam) {
        const playerInfo = scoreboardTeam.players.find(p => p.name === playerName);
        return isPlayerDead(playerInfo, gameTime.value);
    }

    const teamfightEntry = props.teamfight?.damageDealt.find(
        e => e.team === props.team && e.name === playerName
    );
    return getRemaining(teamfightEntry?.respawnAt, gameTime.value) > 0;
}

const isCurrentPlayerDead = computed(() => isPlayerDeadByIndex(currentPlayerIndex.value))
onMounted(async () => {
    try {
        const game = await client.api.game.getCurrentGame();
        if (!game) {
            return;
        }
        const playersInGame = await client.api.game.getPlayersInGame(game.gameId);
        playersOnTeam.value = playersInGame[props.team]
        if (props.show) {
            //preload all player icons to prevent delay when rotating through them. 
            // create a list of promises that resolve when the image is loaded or fails to load, then wait for all promises to resolve before starting the rotation.
            const preloadPromises = playersOnTeam.value.map(player => {
                return new Promise<void>((resolve) => {
                    if (!player.iconUri) {
                        resolve();
                        return;
                    }
                    const img = new Image();
                    img.src = client.getCacheUrl(player.iconUri);
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            });
            await Promise.all(preloadPromises);

            intervalId = window.setInterval(() => {
                currentPlayerIndex.value = (currentPlayerIndex.value + 1) % playersOnTeam.value.length;
            }, rotationInterval);
        } else {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    } catch (error) {
        // Ignore
    }

})

onUnmounted(() => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
})
</script>

<template>
    <div v-if="show" id="player-scoreboard-camera" class="bg-black/55 flex flex-col">
        <div class="relative flex-1 grow overflow-hidden">
            <!-- Preload iframes only for players that have a video stream -->
            <template v-for="(player, index) in playersOnTeam" :key="player.alias + '#' + player.tag">
                <iframe v-if="player.videoStreamUrl" :style="{
                    filter: isPlayerDeadByIndex(index) ? 'grayscale(1)' : 'grayscale(0)',
                    transition: 'filter 0.5s ease',
                    visibility: index === currentPlayerIndex ? 'visible' : 'hidden',
                    zIndex: index === currentPlayerIndex ? 1 : 0
                }" :src="player.videoStreamUrl + '&cover'" allow="autoplay; camera; microphone; fullscreen"
                    class="absolute top-0 left-0 w-full h-full rounded-t border-0" />
            </template>
            <!-- Fallback image for the current player if they have no video stream -->
            <img v-if="playersOnTeam[currentPlayerIndex] && !playersOnTeam[currentPlayerIndex]?.videoStreamUrl && playersOnTeam[currentPlayerIndex]?.iconUri"
                :style="{
                    filter: isCurrentPlayerDead ? 'grayscale(1)' : 'grayscale(0)',
                    transition: 'filter 0.5s ease'
                }" :src="client.getCacheUrl(playersOnTeam[currentPlayerIndex]?.iconUri)" alt="Player icon"
                class="absolute top-0 left-0 w-full h-full object-cover object-top rounded-t" @error="handleImageError"
                @load="handleImageLoad" />
            <div v-if="!playersOnTeam.length" class="w-full h-full flex items-center justify-center bg-black">
            </div>
        </div>
        <span class="player-name">{{ playersOnTeam[currentPlayerIndex]?.alias }}</span>
    </div>
</template>

<style lang="css" scoped>
.player-name {
    display: flex;
    align-items: center;
    justify-content: center;
    justify-self: center;
    height: 40px;
    width: 100%;
    background-color: rgba(0, 0, 0, 1);
    color: white;
    font-size: 22px;
    line-height: 22px;
    text-align: center;
    font-weight: bolder;
    font-family: "Bebas Neue", sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>