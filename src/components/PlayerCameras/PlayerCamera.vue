<script setup lang="ts">
import { useClient } from '@/client';
import { handleImageError, handleImageLoad } from '@/utils/imageUtils';
import { ingameDamageGraphData, ingameScoreboardBottomData, teamMember, type Team, isPlayerDead, getRemaining } from '@bluebottle_gg/league-broadcast-client';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useIngameSelector } from '@/composables/useIngame';

// 1. Added camerasOnly to the props
const props = withDefaults(defineProps<{
    show: boolean
    team: Team
    scoreboard?: ingameScoreboardBottomData
    teamfight?: ingameDamageGraphData
    camerasOnly?: boolean
}>(), {
    camerasOnly: false
});

const client = useClient();
const gameTime = useIngameSelector((s) => s.gameData.gameTime);
const playersOnTeam = ref<teamMember[]>([]);

const rotationCounter = ref(0);
const rotationInterval = 10000;
let intervalId: number | null = null;

function getPlayerKey(player: teamMember | null | undefined): string {
    if (!player) return '';
    return `${player.alias}#${player.tag}`;
}

// 2. The core logic change: Filter the roster based on the prop
const displayRoster = computed(() => {
    if (props.camerasOnly) {
        return playersOnTeam.value.filter(p => p.videoStreamUrl);
    }
    return playersOnTeam.value;
});

// 3. Current player safely selects from the active roster
const currentPlayer = computed(() => {
    if (displayRoster.value.length === 0) return null;
    const index = rotationCounter.value % displayRoster.value.length;
    return displayRoster.value[index];
});

// Update the dead check to use the currentPlayer object directly
function isCurrentPlayerDeadCheck(): boolean {
    if (!currentPlayer.value) return false;

    const playerName = `${currentPlayer.value.alias}#${currentPlayer.value.tag}`;

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

const isCurrentPlayerDead = computed(() => isCurrentPlayerDeadCheck());

function getIframeSrc(player: teamMember): string {
    // For better performance and not crash OBS/vMix, we can request a lower bitrate stream for the preview
    //return `${player.videoStreamUrl}&cover&noaudio`;
    return `${player.videoStreamUrl}&cover&videobitrate=500&height=360&noaudio`;
}

onMounted(async () => {
    try {
        const game = await client.api.game.getCurrentGame();
        if (!game) return;

        const playersInGame = await client.api.game.getPlayersInGame(game.gameId);
        playersOnTeam.value = playersInGame[props.team] ?? [];

        // Preload fallback icons
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

        // Start Rotation
        intervalId = window.setInterval(() => {
            if (displayRoster.value.length > 0) {
                rotationCounter.value++;
            }
        }, rotationInterval);

    } catch (error) {
        console.error('[PlayerCamera] Failed to load camera data:', error);
    }
});

onUnmounted(() => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
});
</script>

<template>
    <div id="player-scoreboard-camera" class="bg-black/55 flex flex-col transition-opacity duration-300"
        :class="show ? 'opacity-100' : 'opacity-0 pointer-events-none'">

        <div class="relative flex-1 grow overflow-hidden bg-black rounded-t">

            <template v-for="player in playersOnTeam" :key="getPlayerKey(player)">
                <iframe v-if="player.videoStreamUrl" :style="{
                    opacity: getPlayerKey(player) === getPlayerKey(currentPlayer) ? 1 : 0,
                    zIndex: getPlayerKey(player) === getPlayerKey(currentPlayer) ? 10 : 1,
                    transition: 'opacity 0.5s ease'
                }" :src="getIframeSrc(player)" allow="autoplay; camera; microphone; fullscreen"
                    class="absolute inset-0 w-full h-full rounded-t border-0" />
            </template>

            <img v-if="currentPlayer && !currentPlayer.videoStreamUrl && currentPlayer.iconUri" :style="{
                filter: isCurrentPlayerDead ? 'grayscale(1)' : 'grayscale(0)',
                transition: 'filter 0.5s ease'
            }" :src="client.getCacheUrl(currentPlayer.iconUri)" alt="Player icon"
                class="absolute inset-0 w-full h-full object-cover object-top rounded-t z-10" @error="handleImageError"
                @load="handleImageLoad" />

            <div v-if="isCurrentPlayerDead"
                class="absolute inset-0 bg-black/50 z-20 rounded-t pointer-events-none transition-colors duration-500" />

            <div v-if="displayRoster.length === 0"
                class="absolute inset-0 flex items-center justify-center bg-black z-30"></div>
        </div>

        <span class="player-name">{{ currentPlayer?.displayName || currentPlayer?.alias || '' }}</span>
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
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>