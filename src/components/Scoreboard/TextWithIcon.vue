<script setup lang="ts">
const props = defineProps<{
  text: string
  iconUrl?: string
  mirror?: boolean
  /** Reserve a fixed width for the text (e.g. "2ch") so changing values don't shift the layout. */
  textWidth?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
    <img v-if="iconUrl" :src="iconUrl" alt="Icon" class="w-6 h-6 object-contain shrink-0" />
    <span
      class="text-2xl font-bold"
      :style="
        textWidth
          ? {
              minWidth: textWidth,
              textAlign: mirror ? 'right' : 'left',
            }
          : undefined
      "
      >{{ text }}</span
    >
  </div>
</template>
