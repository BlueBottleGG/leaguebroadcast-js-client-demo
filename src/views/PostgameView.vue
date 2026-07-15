<script setup lang="ts">
// Post-game recap scene on its own page, usable as a standalone OBS browser
// source (/postgame). The scene self-gates on post-game being active, so it
// stays blank until a result is shown.
import PostGameScene from '@/components/PostGame/PostGameScene.vue'
import DebugBackground from '@/components/Debug/DebugBackground.vue'
</script>

<template>
  <div class="overlay">
    <DebugBackground />
    <PostGameScene />
  </div>
</template>
