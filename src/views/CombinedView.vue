<script setup lang="ts">
import IngameOverlay from '@/components/Ingame/IngameOverlay.vue'
import ChampionSelectScene from '@/components/ChampionSelect/ChampionSelectScene.vue'
</script>

<template>
  <IngameOverlay />
  <!-- Champion Select (pregame) scene, overlaid on top of the ingame overlay -->
  <ChampionSelectScene />
</template>
