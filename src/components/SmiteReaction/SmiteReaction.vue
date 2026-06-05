<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import logoUrl from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import type { smiteReactionResult } from '@bluebottle_gg/league-broadcast-client';
import { useClient } from '@/client';

const _logoPreload = new window.Image()
_logoPreload.src = logoUrl

const client = useClient();
const smite = ref<smiteReactionResult | undefined>(undefined)
const unsub = client.onIngameEvents({
    onSmiteReactionEvent(event) {
        smite.value = event
    }
})
function formatReactionTime(seconds: number): string {
    if (Math.abs(seconds) >= 1) {
        return `${Math.abs(seconds).toFixed(2)}s`
    } else {
        return `${(Math.abs(seconds) * 1000).toFixed(0)}ms`
    }
}

function reactionColor(seconds: number): string {
    if (seconds < 0) return '#E84057'
    if (seconds <= 0.15) return '#4CAF50'
    if (seconds <= 0.4) return '#FFC107'
    return '#E84057'
}

function reactionLabel(seconds: number): string {
    if (seconds < 0) return 'EARLY'
    if (seconds <= 0.05) return 'PERFECT'
    if (seconds <= 0.15) return 'GREAT'
    if (seconds <= 0.4) return 'AVERAGE'
    return 'SLOW'
}

// Animated reaction time: counts up from 0, drives color, label, and ring fill
const animatedReactionTime = ref(0)
const showSecured = ref(false)
let lastAnimatedTarget: number | null = null
let smiteRevealTimer: ReturnType<typeof setTimeout> | null = null

watch(smite, (newSmite) => {
    if (!newSmite) {
        animatedReactionTime.value = 0
        lastAnimatedTarget = null
        showSecured.value = false
        if (smiteRevealTimer) clearTimeout(smiteRevealTimer)
        return
    }
    const target = newSmite.reactionTimeSeconds
    if (target === lastAnimatedTarget) return
    lastAnimatedTarget = target

    showSecured.value = false
    if (smiteRevealTimer) clearTimeout(smiteRevealTimer)
    animatedReactionTime.value = 0

    const START_DELAY = 500
    const DURATION = 900
    const startTime = performance.now()

    smiteRevealTimer = setTimeout(() => { showSecured.value = true }, START_DELAY + DURATION + 150)

    function animate(now: number) {
        if (now < startTime + START_DELAY) {
            requestAnimationFrame(animate)
            return
        }
        const progress = Math.min((now - startTime - START_DELAY) / DURATION, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        animatedReactionTime.value = target * eased
        if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
}, { immediate: true })

const junglerPortrait = computed(() => {
    if (!smite.value?.junglerChampion?.squareImg) return ''
    return client.getCacheUrl(smite.value.junglerChampion.squareImg)
})

const junglerName = computed(() =>
    smite.value?.junglerName.split('#')[0]?.toUpperCase() ?? ''
)

/** CSS conic gradient for the reaction ring — follows animated value */
const ringGradient = computed(() => {
    if (!smite.value) return ''
    const color = reactionColor(animatedReactionTime.value)
    const pct = Math.min(100, (animatedReactionTime.value / 0.6) * 100)
    return `conic-gradient(${color} 0% ${pct}%, rgba(255,255,255,0.08) ${pct}% 100%)`
})

onUnmounted(() => {
    unsub()
    if (smiteRevealTimer) clearTimeout(smiteRevealTimer)
})

</script>

<template>
    <div class="absolute pointer-events-none select-none z-40" style="top: 94px; right: 296px; font-family: Arial;">
        <Transition name="smite-pop" appear>
            <div v-if="smite" class="flex flex-col items-center"
                style="background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
                <div class="flex flex-row items-center gap-3 px-4 py-3 min-w-64">
                    <!-- Reaction ring with champion portrait -->
                    <div class="smite-ring relative shrink-0 flex items-center justify-center"
                        style="width: 56px; height: 56px;">
                        <!-- Ring background -->
                        <div class="absolute inset-0 rounded-full" :style="{ background: ringGradient }" />
                        <!-- Inner cutout -->
                        <div class="absolute rounded-full overflow-hidden" style="inset: 3px;">
                            <img v-if="junglerPortrait" :src="junglerPortrait" class="w-full h-full object-cover" alt=""
                                style="border-radius: 50%; object-fit: cover;" />
                            <div v-else class="w-full h-full" style="background: rgba(255,255,255,0.05);" />
                        </div>
                    </div>

                    <!-- Text content -->
                    <div class="flex flex-col gap-0.5">
                        <span class="smite-title leading-none"
                            style="font-family: Arial; font-weight: 700; font-size: 12px; text-align: left; color: rgba(255,255,255,0.85);">
                            SMITE REACTION
                        </span>
                        <span class="smite-time tabular-nums leading-none pt-1"
                            :style="{ fontFamily: 'Arial', fontWeight: '700', fontSize: '24px', textAlign: 'left', color: reactionColor(animatedReactionTime) }">
                            {{ formatReactionTime(animatedReactionTime) }}
                        </span>
                        <div class="smite-badges flex items-center gap-2 mt-0.5">
                            <span class="tracking-wider px-1.5 py-0.5" :style="{
                                fontFamily: 'Arial', fontWeight: '700', fontSize: '11px', textAlign: 'center',
                                borderRadius: '2px',
                                color: reactionColor(animatedReactionTime),
                                background: reactionColor(animatedReactionTime) + '20',
                            }">
                                {{ reactionLabel(animatedReactionTime) }}
                            </span>
                            <span class="tracking-wider px-1.5 py-0.5" :style="{
                                fontFamily: 'Arial', fontWeight: '700', fontSize: '11px', textAlign: 'center',
                                borderRadius: '2px',
                                color: smite.wasKillingBlow ? '#4CAF50' : '#E84057',
                                background: smite.wasKillingBlow ? 'rgba(76,175,80,0.12)' : 'rgba(232,64,87,0.12)',
                                opacity: showSecured ? 1 : 0,
                                transition: 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }">
                                {{ smite.wasKillingBlow ? 'SECURED' : 'MISSED' }}
                            </span>
                        </div>
                        <div class="smite-player flex items-center gap-3 mt-1">
                            <span class="tabular-nums"
                                style="font-family: Arial; font-weight: 400; font-size: 12px; text-align: left; color: rgba(255,255,255,0.85);">
                                {{ junglerName }}
                            </span>
                        </div>
                    </div>
                </div>


                <!-- Sponsor strip -->
                <div class="smite-sponsor flex flex-row justify-end pb-2">
                    <p class="text-white font-bold pr-2"
                        style="font-family: Arial; font-weight: 700; font-size: 8px; text-align: right; color: #ffffff; line-height: 20px;">
                        POWERED BY</p>
                    <img :src="logoUrl" alt="LeagueBroadcast" style="height: 20px;" />
                </div>
            </div>
        </Transition>

    </div>
</template>

<style scoped>
/* --- Badge pop (secured/missed) --- */
.badge-pop-enter-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.badge-pop-leave-active {
    transition: all 0.2s ease;
}

.badge-pop-enter-from,
.badge-pop-leave-to {
    opacity: 0;
    transform: scale(0.75);
}

/* --- Card enter/exit --- */
.smite-pop-enter-active {
    transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.25s ease;
}

.smite-pop-leave-active {
    transition: transform 0.25s ease-in, opacity 0.2s ease;
}

.smite-pop-enter-from {
    transform: translateX(80px) scale(0.85);
    opacity: 0;
}

.smite-pop-leave-to {
    transform: translateX(40px) scale(0.9);
    opacity: 0;
}

/* --- Inner element staggered enter --- */
.smite-ring {
    animation: ringEnter 0.45s ease 0.12s both;
}

.smite-title {
    animation: slideDownFade 0.3s ease 0.18s both;
}

.smite-time {
    animation: scaleFade 0.38s cubic-bezier(0.34, 1.4, 0.64, 1) 0.22s both;
}

.smite-badges {
    animation: slideUpFade 0.3s ease 0.28s both;
}

.smite-player {
    animation: fadeIn 0.25s ease 0.34s both;
}

.smite-sponsor {
    animation: fadeIn 0.3s ease 0.38s both;
}

/* --- Inner element exit (triggered by parent leave-active shortening duration) --- */
.smite-pop-leave-active .smite-ring,
.smite-pop-leave-active .smite-title,
.smite-pop-leave-active .smite-time,
.smite-pop-leave-active .smite-badges,
.smite-pop-leave-active .smite-player,
.smite-pop-leave-active .smite-sponsor {
    animation: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
    opacity: 0;
    transform: translateX(10px);
}

/* --- Keyframes --- */
@keyframes ringEnter {
    from {
        transform: scale(0.3) rotate(-120deg);
        opacity: 0;
    }

    to {
        transform: scale(1) rotate(0deg);
        opacity: 1;
    }
}

@keyframes slideDownFade {
    from {
        transform: translateY(-8px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes scaleFade {
    from {
        transform: scale(0.6);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes slideUpFade {
    from {
        transform: translateY(8px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}
</style>
