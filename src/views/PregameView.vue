<script setup lang="ts">
// Pregame / champion-select scene on its own page, usable as a standalone
// OBS browser source (/pregame). The scene self-gates on champ-select being
// active, so it stays blank until a draft starts.
import ChampionSelectScene from '@/components/ChampionSelect/ChampionSelectScene.vue'
import DebugBackground from '@/components/Debug/DebugBackground.vue'

const props = withDefaults(
  defineProps<{
    enable3d?: boolean
  }>(),
  { enable3d: false },
)
</script>

<template>
  <div class="overlay">
    <DebugBackground />
    <ChampionSelectScene :enable3d="props.enable3d" />
  </div>
</template>
