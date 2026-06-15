<script setup lang="ts">
import { type ingameScoreboardTeamData, type ingameScoreboardBottomPlayerData, getRoleQuest } from '@bluebottle_gg/league-broadcast-client';
import TopIcon from "@/assets/lane/top-placeholder-cropped.svg";
import JungleIcon from "@/assets/lane/jgl-placeholder-cropped.svg";
import MidIcon from "@/assets/lane/mid-placeholder-cropped.svg";
import BotIcon from "@/assets/lane/bot-placeholder-cropped.svg";
import SupportIcon from "@/assets/lane/sup-placeholder-cropped.svg";
import TextWithIcon from './TextWithIcon.vue';
import Grubs from "@/assets/grubs.png";
import Fire from "@/assets/dragon/fire.png";
import Air from "@/assets/dragon/air.png";
import Chemtech from "@/assets/dragon/chemtech.png";
import Hextech from "@/assets/dragon/hextech.png";
import Earth from "@/assets/dragon/earth.png";
import Water from "@/assets/dragon/water.png";
import Elder from "@/assets/dragon/elder.png";
import { handleImageError, handleImageLoad } from '@/utils/imageUtils';

const props = defineProps<{
    team: ingameScoreboardTeamData
    players: ingameScoreboardBottomPlayerData[]
    mirror?: boolean
    isMocking?: boolean
}>()

function isQuestItem(item: { id: number }) {
    if (!item) {
        return false;
    }

    if (item.id >= 1090 && item.id <= 1095) {
        return true;
    }

    if (item.id >= 1200 && item.id <= 1250) {
        return true;
    }

    return false;
}

function playerHasQuestComplete(player: ingameScoreboardBottomPlayerData) {
    if (props.isMocking) {
        return player.respawnAt
    }
    const roleItem = getRoleQuest(player)
    if (!roleItem || !isQuestItem(roleItem)) {
        return true;
    }
    if (!roleItem.stats || roleItem.stats.length < 2) {
        return false;
    }
    if (roleItem.id === 1220) {
        return true;
    }
    const current = roleItem.stats[0] ?? 0;
    const max = roleItem.stats[1] ?? 1;
    return current >= max;
}

function allQuestsComplete() {
    return props.players.every(playerHasQuestComplete);
}
const roleIcons = [TopIcon, JungleIcon, MidIcon, BotIcon, SupportIcon];

function getDragonIcon(dragonType: string) {
    switch (dragonType.toLowerCase()) {
        case "fire":
            return Fire;
        case "air":
            return Air;
        case "chemtech":
            return Chemtech;
        case "hextech":
            return Hextech;
        case "earth":
            return Earth;
        case "water":
            return Water;
        case "elder":
            return Elder;
        default:
            return undefined;
    }
}
</script>

<template>
    <div class="flex items-center h-full" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
        <TransitionGroup name="stagger-fade" tag="div" appear class="flex flex-row h-full items-center gap-2 w-43"
            :class="mirror ? 'justify-end' : 'justify-start'" id="quest-container" :style="{
                'padding-left': mirror ? 'auto' : '8px',
                'padding-right': mirror ? '8px' : 'auto',
            }">
            <div v-for="(player, i) in players" v-if="!allQuestsComplete()" :key="i"
                class="flex items-center justify-center gap-1 rounded-full p-1 w-6 h-6 border" :style="{
                    borderColor: playerHasQuestComplete(player) ? (mirror ? 'var(--red-team-color)' : 'var(--blue-team-color)') : '#ffffff55',
                    backgroundColor: playerHasQuestComplete(player) ? `color-mix(in srgb, ${mirror ? 'var(--red-team-color)' : 'var(--blue-team-color)'} 10%, transparent)` : '#00000066',
                    color: playerHasQuestComplete(player) ? (mirror ? 'var(--red-team-color)' : 'var(--blue-team-color)') : '#ffffff',
                    '--i': mirror ? (players.length - 1 - i) : i
                }">
                <component :is="roleIcons[i]" class="w-4 h-4" />
            </div>
        </TransitionGroup>

        <TextWithIcon class="h-6" :icon-url="Grubs" :text="props.team.grubs.toString()" :mirror="mirror"
            :class="mirror ? ['pr-2'] : ['pl-2']" />


        <TransitionGroup name="stagger-fade" tag="div" appear
            class="flex flex-row justify-start h-full grow items-center gap-2 mx-4"
            :class="mirror ? 'flex-row' : 'flex-row-reverse'">
            <img v-for="(dragon, i) in team.dragons" :key="i" :src="getDragonIcon(dragon)" alt="Dragon icon"
                class="h-5 w-auto" @error="handleImageError" @load="handleImageLoad" />
        </TransitionGroup>


    </div>
</template>


<style lang="css" scoped>
.stagger-fade-enter-active,
.stagger-fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.stagger-fade-enter-active {
    transition-delay: calc(700ms + var(--i) * 120ms);
}

.stagger-fade-enter-from,
.stagger-fade-leave-to {
    opacity: 0;
    transform: translateY(6px);
}
</style>