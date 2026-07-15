<script setup lang="ts">
import TeamfightRecap from './TeamfightRecap.vue'
import TeamfightDamageDealt from './TeamfightDamageDealt.vue'
</script>

<template>
  <!-- Backend-triggered damage panels stack in one centered column.
       Centered via flex, not translateX(-50%) — the components animate transform
       on enter/leave, which would clobber transform-based centering. -->
  <div class="teamfight-panels">
    <TeamfightRecap />
    <TeamfightDamageDealt />
  </div>
</template>

<style scoped>
.teamfight-panels {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
</style>
