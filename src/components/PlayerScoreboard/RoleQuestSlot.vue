<script setup lang="ts">
import { useClient } from '@/client';
import type { itemWithAsset } from '@bluebottle_gg/league-broadcast-client';
import { computed } from 'vue';
import ItemWithCooldown from './ItemWithCooldown.vue';
import { handleImageError, handleImageLoad } from '@/utils/imageUtils';


const props = defineProps<{ mirror?: boolean, item?: itemWithAsset, progressColor?: string }>();
defineOptions({ inheritAttrs: false })
const client = useClient();

const progressPercent = computed(() => {
    if (!props.item || !props.item.stats || props.item.stats.length < 2) {
        return 0;
    }

    //current at 1 index, max at 2 index
    const current = props.item.stats[0] ?? 0;
    const max = props.item.stats[1] ?? 1;
    const value = Math.min(100, Math.max(0, (current / max) * 100));
    if (value < 10) {
        return 0
    }
    return value
});

// Using pathLength="100" on the rect normalizes the path to work with percentages
const strokeDashoffset = computed(() => {
    // At 0% progress, offset = 100 (nothing visible)
    // At 100% progress, offset = 0 (full border visible)
    return 100 - progressPercent.value;
});

//A list of all item ids available at: https://darkintaqt.com/blog/item-ids
const isQuestItem = computed(() => {
    if (!props.item) {
        return false;
    }

    if (props.item.id >= 1090 && props.item.id <= 1095) {
        return true;
    }

    if (props.item.id >= 1200 && props.item.id <= 1250) {
        return true;
    }

    return false;
})

const isTopTeleportComplete = computed(() => {
    if (!props.item) {
        return false;
    }

    return props.item.id === 1220;
})

</script>

<template>
    <div v-if="isQuestItem">

        <!-- Show teleport as a spell, not an item -->
        <ItemWithCooldown v-if="isTopTeleportComplete" :item="item" />
        <div :class="[$attrs.class ?? 'w-8', 'relative']" v-else>
            <svg class="absolute inset-0 pointer-events-none" width="100%" height="100%" style="overflow: visible;">
                <!-- Progress border rectangle -->
                <rect x="0" y="0" width="100%" height="100%" fill="none" :stroke="props.progressColor ?? '#fff'"
                    :stroke-width="2" pathLength="100" stroke-dasharray="100" :stroke-dashoffset="strokeDashoffset"
                    style="transition: stroke-dashoffset 0.3s ease;" v-if="progressPercent < 100" />
            </svg>
            <div class="w-full h-full relative">
                <img class="absolute inset-0 w-full h-full" :src="client.getCacheUrl(item?.assetUrl)"
                    @error="handleImageError" @load="handleImageLoad" />
            </div>
        </div>

    </div>

    <ItemWithCooldown v-else :class="$attrs.class" :item="item" />
</template>