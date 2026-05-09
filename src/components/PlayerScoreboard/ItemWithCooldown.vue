<script setup lang="ts">
import { useClient } from '@/client';
import { getItemCooldownFraction, isItemOnCooldown, getItemCooldownRemaining } from '@bluebottle_gg/league-broadcast-client';
import type { itemWithAsset } from '@bluebottle_gg/league-broadcast-client';
import FadeTransition from '../../transitions/FadeTransition.vue';
import { handleImageError, handleImageLoad } from '@/utils/imageUtils';
import { useIngameSelector } from '@/composables/useIngame';


defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
    item?: itemWithAsset,
    visionScore?: number,
    showStacks?: boolean
}>(), {
    showStacks: true
});

const client = useClient();
const gameTime = useIngameSelector((s) => s.gameData.gameTime);

function getItemIcon(item: itemWithAsset): string {
    return client.getCacheUrl(item.assetUrl)
}

function getItemText(item: itemWithAsset): string {
    if (item.count === 1 && item.charges === 0) {
        return ""
    }

    if (item.charges && item.charges > 0) {

        if (item.charges >= 1000) {
            return (item.charges / 1000).toFixed(1) + 'k'
        }
        return Math.floor(item.charges).toString()
    }

    if (item.count === 1) {
        return ""
    }

    if (item.count >= 1000) {
        return (item.count / 1000).toFixed(1) + 'k'
    }

    return item.count.toString()
}

function getCooldownOverlayStyle(item: itemWithAsset) {
    const fraction = getClampedCooldownFraction(item);
    if (fraction >= 1) {
        return {}
    }
    const elapsedAngle = 360 * fraction;
    return {
        background: `conic-gradient(from 0deg, transparent ${elapsedAngle}deg, rgba(0,0,0,0.6) ${elapsedAngle}deg)`
    }
}

function getCooldownRotationStyle(item: itemWithAsset) {
    const fraction = getClampedCooldownFraction(item);
    if (fraction >= 1) {
        return `rotate(0deg)`
    }

    const rotation = 360 * fraction;
    return `rotate(${rotation}deg)`
}

function getClampedCooldownFraction(item: itemWithAsset) {
    return Math.min(1, Math.max(0, getItemCooldownFraction(item, gameTime.value)))
}

function getVisionScore() {
    if (props.visionScore === undefined) {
        return 0
    }

    return Math.round(props.visionScore)
}

function getStacks() {
    const stacks = props.item?.stacks ?? 0
    if (stacks > 1000 || stacks < 0) {
        return 0;
    }

    return stacks
}

</script>

<template>
    <div class="item-slot">
        <div v-if="!item || item.id === 0" class="item-slot-empty" v-bind="$attrs">

        </div>

        <div v-else class="item-slot-content" v-bind="$attrs">
            <img class="absolute w-full h-full left-0 top-0" v-if="item.modifierUrl"
                :src="client.getCacheUrl(item.modifierUrl)" @error="handleImageError" @load="handleImageLoad" />
            <img class="w-full h-full" :src="getItemIcon(item)" @error="handleImageError" @load="handleImageLoad" />

            <!-- Cooldown overlay + timer clipped to icon bounds -->
            <div class="cooldown-clip" v-if="isItemOnCooldown(item, gameTime)">
                <div :style="getCooldownOverlayStyle(item)" class="cooldown"></div>
                <div class="cooldown-timer">
                    <div class="cooldown-timer-hand" :style="{ 'transform': getCooldownRotationStyle(item) }">
                    </div>
                </div>
            </div>

            <span v-if="showStacks && visionScore === undefined" class="item-count">{{ getItemText(item) }}</span>

            <!-- VisionScore -->
            <FadeTransition>
                <span class="vision-score" v-if="showStacks && visionScore !== undefined">{{ getVisionScore() }}</span>
            </FadeTransition>

            <!-- Trinket Usages -->
            <FadeTransition>
                <span class="vision-stacks" v-if="showStacks && visionScore !== undefined && getStacks() === 1">{{
                    getStacks() }}
                </span>
            </FadeTransition>
        </div>
    </div>

</template>

<style scoped>
.item-slot {
    display: flex;
}

.item-slot-empty {
    background-color: rgba(0, 0, 0, 0.5);
}

.item-slot-content {
    position: relative;
    display: inline-block;
    line-height: 0;
    font-family: "Bebas Neue", sans-serif;
}

.item-slot-content .cooldown-clip {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.item-slot-content img {
    display: block;
}

.item-slot-content span {
    /* Add a subtle text shadow for better visibility */
    text-shadow: 0 0 2px rgba(0, 0, 0, 1);
}

.item-slot-content .item-count {
    position: absolute;
    bottom: 0;
    right: 0;
    text-align: end;
    transform: translate(0px, 3px);
}

.item-slot-content .vision-score {
    position: absolute;
    top: 0;
    left: 0;
    text-align: center;
    transform: translate(0px, -2px);
    width: 100%;
}

.item-slot-content .vision-stacks {
    position: absolute;
    bottom: 0;
    left: 0;
    text-align: end;
    transform: translate(0px, 0px);
    width: 100%;
}

.item-slot-content .cooldown {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.item-slot-content .cooldown-timer-hand {
    position: absolute;
    top: calc(50% - 70.7%);
    left: calc(50% - 0.5px);
    width: 1px;
    height: 70.7%;
    transform-origin: 50% 100%;
    transition: transform 0.5s linear;
    background-color: white;
}
</style>
