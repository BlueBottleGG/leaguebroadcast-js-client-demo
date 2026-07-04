<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: 'sword' | 'sparkle' | 'shield' | 'circle-shield' | 'crossed-swords' | 'boot'
    color?: string
    value: string
  }>(),
  {
    color: '#e0e0e0',
  },
)
</script>

<template>
  <div class="stat-cell">
    <svg
      class="stat-icon"
      viewBox="0 0 24 24"
      :style="{ color }"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Attack Damage: sword -->
      <g v-if="icon === 'sword'">
        <path d="M4 20 L15 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M13 6 L18 4 L20 6 L18 11 L15 9 Z" fill="currentColor" />
        <path d="M4 20 L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      </g>
      <!-- Ability Power: sparkle -->
      <g v-else-if="icon === 'sparkle'">
        <path
          d="M12 3 L13.6 9.4 L20 12 L13.6 14.6 L12 21 L10.4 14.6 L4 12 L10.4 9.4 Z"
          fill="currentColor"
        />
      </g>
      <!-- Armor: pointed shield -->
      <g v-else-if="icon === 'shield'">
        <path
          d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z"
          fill="currentColor"
          opacity="0.9"
        />
      </g>
      <!-- Magic Resist: round shield -->
      <g v-else-if="icon === 'circle-shield'">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" />
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      </g>
      <!-- Attack Speed: crossed swords -->
      <g v-else-if="icon === 'crossed-swords'">
        <path
          d="M4 4 L20 20 M20 4 L4 20"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      </g>
      <!-- Move Speed: boot -->
      <g v-else-if="icon === 'boot'">
        <path
          d="M7 4 H12 V11 L17 14 C19 15 20 16.5 20 18.5 V19 H5 C4.4 19 4 18.6 4 18 V6 C4 5 5 4 7 4 Z"
          fill="currentColor"
        />
        <path d="M8 4 V10" stroke="rgba(0,0,0,0.35)" stroke-width="1" />
      </g>
    </svg>
    <span class="stat-value">{{ value }}</span>
  </div>
</template>

<style lang="css" scoped>
.stat-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.stat-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.stat-value {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 15px;
  color: #f2ead7;
  text-shadow: 0 0 2px rgba(0, 0, 0, 1);
  white-space: nowrap;
}
</style>
