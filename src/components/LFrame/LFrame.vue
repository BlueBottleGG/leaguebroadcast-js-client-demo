<script setup lang="ts">
import { useIsInGame } from '@/composables/useIngame';
import GameInfo from './GameInfo.vue';
import SponsorRotation from './SponsorRotation.vue';
import FadeTransition from '../../transitions/FadeTransition.vue';

const isInGame = useIsInGame();
</script>

<template>
    <FadeTransition>
        <div v-if="isInGame" class="lframe-container">
            <div class="lframe-header">
                <GameInfo />
            </div>
            <div id="champion-info-cutout" aria-hidden="true">
                <svg class="cutout-frame" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                        d="M 0 0 H 100 V 100 H 0 Z M 3 0 L 90 0 L 95 12 L 95 37 L 92 37 L 92 57 L 95 57 L 95 100 L 3 100 Z"
                        fill="black" fill-rule="evenodd" clip-rule="evenodd" />
                </svg>
            </div>
            <div class="lframe-footer">
                <SponsorRotation />
            </div>
        </div>
    </FadeTransition>
</template>

<style lang="css" scoped>
.lframe-container {
    display: grid;
    grid-template-rows: 38px 1fr 114px;
    grid-template-columns: 1fr;
    z-index: 100;
}

.lframe-header,
.lframe-footer {
    background-color: black;
}

#champion-info-cutout {
    position: relative;
    min-height: 0;
}

.cutout-frame {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
