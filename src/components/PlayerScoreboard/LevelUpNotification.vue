<script setup lang="ts">
defineProps<{
    level?: number
    visible: boolean
    exiting: boolean
    mirror?: boolean
}>()
</script>

<template>
    <div class="level-up-overlay" :class="{ 'is-visible': visible, 'is-exiting': exiting, 'is-chaos': mirror }">
        <div class="level-up-content">
            <span class="level-up-label">LEVEL</span>
            <span class="level-up-number">{{ level }}</span>
        </div>
    </div>
</template>

<style lang="css" scoped>
.level-up-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--blue-team-color);
    border: 1px solid white;
    border-radius: 0px;
    pointer-events: none;
    z-index: 10;
    transform: translateY(100%);
    opacity: 0;
    transition: transform 0.35s ease-out, opacity 0.35s ease-out;
}

.level-up-overlay.is-chaos {
    background: var(--red-team-color);
}

.level-up-overlay.is-visible {
    transform: translateY(0);
    opacity: 1;
}

.level-up-overlay.is-exiting {
    transform: translateY(-100%);
    opacity: 0;
}

.level-up-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
}

.level-up-label {
    font-weight: 800;
    font-size: 10px;
    color: white;
    letter-spacing: 1px;
}

.level-up-number {
    font-weight: 800;
    font-size: 22px;
    color: white;
    text-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
}
</style>
