<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getElement } from './elements'
import DebugBackground from '@/components/Debug/DebugBackground.vue'

const route = useRoute()
const element = computed(() => getElement(String(route.params.slug)))
</script>

<template>
  <div v-if="element" class="overlay">
    <DebugBackground />
    <component
      :is="part.component"
      v-for="(part, i) in element.parts"
      :key="`${element.slug}-${i}`"
      v-bind="part.props"
      :class="part.class"
    />
  </div>
  <div v-else class="unknown">
    <p>
      Unknown element "{{ route.params.slug }}" —
      <RouterLink to="/ingame/elements">see the element index</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.unknown {
  display: grid;
  place-content: center;
  width: 1920px;
  height: 1080px;
  background: #10131a;
  font-size: 24px;
}

.unknown a {
  color: var(--broadcast-accent);
}
</style>
