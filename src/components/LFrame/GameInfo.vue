<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame';
import BBLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import FadeTransition from '../../transitions/FadeTransition.vue';

const patch = useIngameSelector((s) => s.gameData.patch);
const otherInfo = ["LIB DEMO GAME 2026"];
const allInfo = computed(() => [...otherInfo, `PATCH ${patch.value}`]);

const currentInfoIndex = ref(0);
const currentInfo = computed(() => allInfo.value[currentInfoIndex.value] ?? '');
const infoRotationInterval = 15000; // Rotate info every 15 seconds
const rotationTimer = ref<number | null>(null);

onMounted(() => {
    rotationTimer.value = setInterval(() => {
        currentInfoIndex.value = (currentInfoIndex.value + 1) % allInfo.value.length;
    }, infoRotationInterval);
});

onUnmounted(() => {
    if (rotationTimer.value !== null) {
        clearInterval(rotationTimer.value);
    }
});
</script>

<template>
    <div class="flex flex-row justify-between items-center pl-2.5 pr-10 py-1 w-full h-full">
        <BBLogo class="h-8" />
        <div class="info-text-slot">
            <FadeTransition mode="out-in">
                <span :key="currentInfoIndex" class="patch-text">{{ currentInfo }}</span>
            </FadeTransition>
        </div>
    </div>

</template>

<style lang="css" scoped>
.info-text-slot {
    display: grid;
    justify-items: end;
    align-items: center;
    overflow: hidden;
}

.patch-text {
    grid-area: 1 / 1;
    color: white;
    font-size: 20px;
    line-height: 1;
    font-weight: 800;
    font-weight: bold;
    white-space: nowrap;
}
</style>