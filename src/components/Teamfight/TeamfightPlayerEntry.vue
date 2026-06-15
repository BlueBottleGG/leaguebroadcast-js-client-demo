<script setup lang="ts">
import { useClient } from "@/client";
import ProgressBar from "@/components/PlayerScoreboard/ProgressBar.vue";
import { ResourceType, SpellSlotIndex, type damageGraphEntry, getRemaining } from "@bluebottle_gg/league-broadcast-client";
import SpellWithCooldown from "../PlayerScoreboard/SpellWithCooldown.vue";
import { computed } from "vue";
import { useIngameSelector } from "@/composables/useIngame";
import ItemWithCooldown from "../PlayerScoreboard/ItemWithCooldown.vue";
import FadeTransition from "@/transitions/FadeTransition.vue";

const props = withDefaults(defineProps<{
    mirror?: boolean;
    data?: damageGraphEntry;
}>(), {
    mirror: false,
    data: undefined
});

const client = useClient();
const gameTime = useIngameSelector((s) => s.gameData.gameTime);

const respawnRemaining = computed(() => getRemaining(props.data?.respawnAt, gameTime.value));

const spellD = computed(() => {
    if (!props.data || !props.data.abilities || !props.data.abilities[SpellSlotIndex.D]) return undefined;
    return props.data.abilities[SpellSlotIndex.D];
});

const spellF = computed(() => {
    if (!props.data || !props.data.abilities || !props.data.abilities[SpellSlotIndex.F]) return undefined;
    return props.data.abilities[SpellSlotIndex.F];
});

const spellR = computed(() => {
    if (!props.data || !props.data.abilities || !props.data.abilities[SpellSlotIndex.R]) return undefined;
    return props.data.abilities[SpellSlotIndex.R];
});

const healthPct = computed(() => {
    if (!props.data) return 0;
    return ((props.data.health?.current ?? 0) / (props.data.health?.max ?? 1)) * 100
});

const resourcePct = computed(() => {
    if (!props.data) return 0;
    return ((props.data.resource?.current ?? 0) / (props.data.resource?.max ?? 1)) * 100
});

const resourceColor = computed(() => {
    //resource type might be a string, so parse it to enum if needed
    const resourceType = typeof props.data?.resource?.type === "string"
        ? ResourceType[props.data.resource.type as keyof typeof ResourceType]
        : props.data?.resource?.type;

    switch (resourceType) {
        case ResourceType.mana: return "#1d4ed8";
        case ResourceType.energy: return "#d6db29";
        case ResourceType.none: return "transparent";
        case ResourceType.shield: return "#A9A9A9";
        case ResourceType.battlefury:
        case ResourceType.dragonfury:
        case ResourceType.rage:
        case ResourceType.heat:
        case ResourceType.gnarfury:
        case ResourceType.ferocity:
        case ResourceType.bloodwell: return "#bf0000";
        case ResourceType.wind: return "#A9A9A9";
        case ResourceType.unknown:
        default: return "#1d4ed8";
    }
});

const xpPct = computed(() => {
    if (!props.data) return 0;
    const previous = props.data.experience?.previousLevel ?? 0;
    const next = props.data.experience?.nextLevel ?? 1;
    const current = props.data.experience?.current ?? 0;
    return ((current - previous) / (next - previous)) * 100;
});
</script>


<template>

    <!-- Main grid: ult + spells + splash + bars on left 2 cols, items on right col -->
    <div class="main-grid" :class="mirror ? 'mirrored' : ''" :style="{
        filter: respawnRemaining > 0 ? 'grayscale(1)' : 'grayscale(0)',
        transition: 'filter 0.5s ease'
    }">
        <!-- Ultimate icon: centered over the 2-col section -->
        <div class="area-ult flex justify-center py-1">
            <SpellWithCooldown v-if="spellR?.assets?.iconAsset" :ready-at="spellR?.readyAt"
                :img="client.getCacheUrl(spellR?.assets?.iconAsset)" show-timer :skilled="spellR?.level > 0"
                :total-cooldown="spellR?.totalCooldown" class="champion-icon rounded-full"
                style="--cooldown-font-size: 32px" />
            <div v-else class="champion-icon rounded-full"></div>
        </div>

        <!-- Spell icons: top-left 2 cells -->
        <SpellWithCooldown :ready-at="spellD?.readyAt" :img="client.getCacheUrl(spellD?.assets?.iconAsset)" show-timer
            skilled :total-cooldown="spellD?.totalCooldown" class="spell-icon area-spell1" />
        <SpellWithCooldown :ready-at="spellF?.readyAt" :img="client.getCacheUrl(spellF?.assets?.iconAsset)" show-timer
            skilled :total-cooldown="spellF?.totalCooldown" class="spell-icon area-spell2" />

        <!-- Splash portrait -->
        <div class="player-portrait bg-zinc-600 area-splash">
            <img :src="client.getCacheUrl(data?.champion?.squareImg)" class="object-cover w-full h-full" />
            <FadeTransition>
                <span v-if="respawnRemaining > 0" class="respawn-timer">{{ Math.ceil(respawnRemaining) }}</span>
            </FadeTransition>
        </div>

        <!-- Level + progress bars -->
        <div class="area-bars flex h-7" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
            <div class="level-text" :style="{
                borderLeft: mirror ? '1px solid rgba(255, 255, 255, 0.55)' : 'none',
                borderRight: mirror ? 'none' : '1px solid rgba(255, 255, 255, 0.55)'
            }">
                {{ data?.level }}
            </div>
            <div class="flex-1 flex flex-col gap-0.5 p-0.5 area-progress">
                <ProgressBar :progress-pct="xpPct" fill-color="#a78bfa" :mirror="mirror" class="flex-1" />
                <ProgressBar :progress-pct="healthPct" fill-color="#22c55e" :mirror="mirror" class="flex-2" />
                <ProgressBar :progress-pct="resourcePct" :fill-color="resourceColor" :mirror="mirror" class="flex-2" />
            </div>
        </div>

        <!-- Items: all in one column -->
        <div class="area-items flex flex-col">
            <ItemWithCooldown v-for="(item, index) in data?.activeItems" :key="index" :item="item" class="item-slot "
                :show-stacks="false" />
        </div>
    </div>

</template>


<style lang="css" scoped>
.champion-icon {
    width: 80%;
    aspect-ratio: 1 / 1;
    transform: translateY(15%);
    z-index: 2;
}

/*
  3-column grid: [spell/splash/bars (×2)] [items]
  Mirrored flips column order via grid-template-areas.
*/
.main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
        "ult    ult    empty"
        "spell1 spell2 items"
        "splash splash items"
        "bars   bars   items";
}

.main-grid.mirrored {
    grid-template-areas:
        "empty ult    ult   "
        "items spell1 spell2"
        "items splash splash"
        "items bars   bars  ";
}

.area-ult {
    grid-area: ult;
}

.area-spell1 {
    grid-area: spell1;
}

.area-spell2 {
    grid-area: spell2;
}

.area-splash {
    grid-area: splash;
    border-left: 1px solid rgba(255, 255, 255, 0.55);
    border-right: 1px solid rgba(255, 255, 255, 0.55);
    border-top: 1px solid rgba(255, 255, 255, 0.55);
}

.area-bars {
    grid-area: bars;
    border: 1px solid rgba(255, 255, 255, 0.55);
    background-color: black;
}

.area-items {
    grid-area: items;

}

.spell-icon {
    aspect-ratio: 1 / 1;
    width: 100%;
    border: 2px solid rgba(0, 0, 0, 0.6);
}

.player-portrait {
    aspect-ratio: 1 / 1;
    width: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;

}

.item-slot {
    width: 100%;
    aspect-ratio: 1 / 1;
}

.level-text {
    font-weight: 800;
    width: calc(100% / 3);
    background-color: black;
    display: flex;
    justify-content: center;
    align-items: center;
}

.respawn-timer {
    position: absolute;
    color: white;
    font-weight: 800;
    font-size: 32px;
    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
}
</style>