<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame';
import { Team, type ingameObjectivePowerPlay } from '@bluebottle_gg/league-broadcast-client';
import { computed, ref, watch } from 'vue';
import Baron from '@/assets/baron/baron.png'
import Elder from '@/assets/dragon/elder.png'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils';

const props = withDefaults(defineProps<{
    team: Team
    mirror?: boolean
    powerPlay?: ingameObjectivePowerPlay
    type?: 'baron' | 'dragon'
}>(), {
    mirror: false
})
const gameTime = useIngameSelector((s) => s.gameData.gameTime)
const hasPowerPlay = computed(() => {
    return props.powerPlay !== undefined && props.powerPlay.timeEnd > gameTime.value && props.powerPlay.timeStart <= gameTime.value
})

function getPowerPlayProgress(powerPlay: ingameObjectivePowerPlay | undefined) {
    if (!powerPlay) return 0
    const totalDuration = powerPlay.timeEnd - powerPlay.timeStart
    const elapsed = gameTime.value - powerPlay.timeStart
    const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1)
    return progress
}

function formatGoldDiff(gold: number) {
    if (gold >= 1000) {
        return `+${(gold / 1000).toFixed(1)}k g`
    } else if (gold <= -1000) {
        return `${(gold / 1000).toFixed(1)}k g`
    } else {
        return `${Math.round(gold)} g`
    }
}

const powerPlayProgress = computed(() => getPowerPlayProgress(props.powerPlay))
const timeRemaining = computed(() => {
    if (!hasPowerPlay.value) return 0
    const remaining = props.powerPlay!.timeEnd - gameTime.value
    return `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${Math.floor(remaining % 60).toString().padStart(2, '0')}`
})

const goldDiff = computed(() => {
    if (!props.powerPlay) return ' - '
    return formatGoldDiff(props.powerPlay.gold)
})

const showCompletion = ref(false)
const completionGold = ref(0)
const completionType = ref<'baron' | 'dragon'>('baron')
let completionTimer: ReturnType<typeof setTimeout> | null = null

watch(hasPowerPlay, (newVal, oldVal) => {
    if (oldVal && !newVal && props.powerPlay && props.type) {
        completionGold.value = props.powerPlay.gold
        completionType.value = props.type
        showCompletion.value = true
        if (completionTimer) clearTimeout(completionTimer)
        completionTimer = setTimeout(() => {
            showCompletion.value = false
            completionTimer = null
        }, 4000)
    }
    if (newVal) {
        showCompletion.value = false
        if (completionTimer) {
            clearTimeout(completionTimer)
            completionTimer = null
        }
    }
})

</script>


<template>
    <div class="pp-container">
        <Transition name="pp">
            <div v-if="hasPowerPlay" key="active" class="power-play">
                <p class="power-play-text">{{ props.type === 'baron' ? 'Baron' : props.type === 'dragon' ? 'Dragon' : ''
                }}
                    Power Play </p>
                <div class="power-play-content" :style="{
                    background: `linear-gradient(90deg, transparent, transparent), linear-gradient(90deg, var(--${props.type === 'baron' ? 'baron' : 'elder'}-color-subtle) 0%, transparent 45%, transparent 55%, var(--${props.type === 'baron' ? 'baron' : 'elder'}-color-subtle) 100%)`,
                }">
                    <div>
                        <p>{{ goldDiff }}</p>
                        <p>{{ timeRemaining }}</p>
                    </div>

                    <img :src="props.type === 'baron' ? Baron : props.type === 'dragon' ? Elder : ''"
                        @error="handleImageError" @load="handleImageLoad" class="power-play-icon" :style="{
                            'border': props.type === 'baron' ? '2px solid var(--baron-color)' : props.type === 'dragon' ? '2px solid var(--elder-color)' : 'none'
                        }">
                </div>
                <div class="power-play-timer" :class="{ mirror: props.mirror }">
                    <div class="power-play-timer-bar"
                        :class="{ 'elder': props.type === 'dragon', 'baron': props.type === 'baron' }" :style="{
                            width: props.type === 'baron' ? `${(1 - powerPlayProgress) * 100}%` : props.type === 'dragon' ? `${(1 - powerPlayProgress) * 100}%` : '0%'
                        }"></div>
                </div>
            </div>

            <div v-else-if="showCompletion" key="complete" class="power-play-completion" :class="completionType">
                <img :src="completionType === 'baron' ? Baron : Elder" @error="handleImageError" @load="handleImageLoad"
                    class="completion-icon" :style="{
                        'border': completionType === 'baron' ? '2px solid var(--baron-color)' : '2px solid var(--elder-color)'
                    }">
                <p class="completion-gold" :style="{
                    color: completionType === 'baron' ? 'var(--baron-color)' : 'var(--elder-color)'
                }">+{{ completionGold >= 1000 ? (completionGold / 1000).toFixed(1) + 'k' : completionGold }}</p>
            </div>
        </Transition>
    </div>
</template>


<style lang="css" scoped>
.pp-container {
    display: grid;
}

.pp-container>* {
    grid-area: 1 / 1;
}

.pp-enter-active {
    transition: opacity 0.25s ease, transform 0.4s ease-in-out;
}

.pp-leave-active {
    transition: opacity 0.25s ease 0.5s;
}

.pp-enter-from {
    opacity: 0;
    transform: scale(0.6);
}

.pp-leave-to {
    opacity: 0;
}

.power-play {
    position: relative;
    width: 175px;
    height: 80px;
    background: black;
    border: 1px solid #ffffff55;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.power-play-text {
    color: white;
    font-weight: 800;
    font-size: 20px;
    line-height: 28px;
    text-shadow: 0 0 2px rgba(0, 0, 0, 1);
    width: 100%;
    text-align: center;
}

.power-play-content {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex-grow: 1;
    color: white;
    font-weight: 800;
    font-size: 16px;
    line-height: 16px;
    padding-left: 20px;
    padding-right: 6px;
}

.power-play-icon {
    width: 33px;
    height: 33px;
    padding: 2px;
    border-radius: 5px;
}

.power-play-timer {
    width: 100%;
    height: 10px;
    background: transparent;
    overflow: hidden;
    margin-top: auto;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    border-top: 1px solid #ffffff55;
}

.power-play-timer.mirror {
    justify-content: flex-end;
}

.power-play-timer-bar {
    transition: width 1s linear;
    height: 100%;
}

.power-play-timer-bar.elder {
    background: var(--elder-color);
}

.power-play-timer-bar.baron {
    background: var(--baron-color);
}

.power-play-completion {
    position: relative;
    width: 175px;
    height: 80px;
    background: black;
    border-width: 1px;
    border-style: solid;
    border-radius: 10px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 10px;
    overflow: hidden;
}

.power-play-completion.baron {
    border-color: var(--baron-color);
}

.power-play-completion.elder {
    border-color: var(--elder-color);
}

.completion-icon {
    width: 40px;
    height: 40px;
    padding: 3px;
    border-radius: 5px;
    flex-shrink: 0;
}

.completion-gold {
    font-weight: 800;
    font-size: 28px;
    line-height: 1;
    text-shadow: 0 2px 4px black;
    white-space: nowrap;
}
</style>
