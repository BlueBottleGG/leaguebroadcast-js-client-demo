<script setup lang="ts">
defineProps<{
    itemIcon?: string
    itemName?: string
    visible: boolean
    exiting: boolean
    mirror?: boolean
}>()
</script>

<template>
    <!-- Spans order-items+order-info (left 465px) or chaos-info+chaos-items (right 465px) -->
    <div class="item-buy-overlay" :class="{ 'is-visible': visible, 'is-exiting': exiting, mirror }">
        <div class="item-buy-content" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
            <img v-if="itemIcon" class="item-icon" :src="itemIcon" />
            <span class="item-name">{{ itemName }}</span>
        </div>
    </div>
</template>

<style lang="css" scoped>
.item-buy-overlay {
    /* Covers order-items (215px) + order-info (250px) = 465px from the left */
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(215px + 250px);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background: linear-gradient(to right, rgba(30, 60, 120, 0.95), rgba(10, 30, 80, 0.85));
    pointer-events: none;
    z-index: 10;
    transform: translateY(100%);
    opacity: 0;
    transition: transform 0.35s ease-out, opacity 0.35s ease-out;
    padding: 0 8px;
}

.item-buy-overlay.mirror {
    /* Covers chaos-info (250px) + chaos-items (215px) = 465px from the right */
    left: unset;
    right: 0;
    justify-content: flex-end;
    background: linear-gradient(to left, rgba(120, 30, 30, 0.95), rgba(80, 10, 10, 0.85));
}

.item-buy-overlay.is-visible {
    transform: translateY(0);
    opacity: 1;
}

.item-buy-overlay.is-exiting {
    transform: translateY(-100%);
    opacity: 0;
}

.item-buy-content {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
}

.item-icon {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-color);
    border-radius: 2px;
    flex-shrink: 0;
}

.item-name {
    font-weight: 800;
    font-size: 24px;
    color: white;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
