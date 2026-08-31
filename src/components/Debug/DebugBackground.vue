<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Optional solid-color `?bg=` background for overlay routes, dev builds only.
 * The default remains transparent for browser-source use. Supported values:
 *   bg=dark            — flat dark
 *   bg=<any CSS color> — e.g. bg=green or bg=%23202833
 *   bg=none            — force transparent
 */
const route = useRoute()

const bg = computed(() => {
  // A leftover development parameter must never paint over a production feed.
  if (!import.meta.env.DEV) return ''

  // Route queries are canonical. Keep the direct location fallback for preview
  // harnesses that mount this component without Vue Router owning the query.
  const fromRoute = typeof route.query.bg === 'string' ? route.query.bg : ''
  const fromSearch = new URLSearchParams(window.location.search).get('bg') ?? ''
  const param = fromRoute || fromSearch
  return param === 'none' || param === 'off' ? '' : param
})

const style = computed(() => {
  if (!bg.value) return undefined
  if (bg.value === 'dark') return { background: '#10131a' }
  return { background: bg.value }
})
</script>

<template>
  <div v-if="style" class="debug-bg" :style="style" />
</template>

<style scoped>
/* Rendered as the first child of .overlay: absolutely positioned siblings
   paint in DOM order, so this stays behind every element without z-index. */
.debug-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
