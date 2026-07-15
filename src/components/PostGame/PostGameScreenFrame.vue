<script setup lang="ts">
/**
 * Shared scaffold for the secondary post-game screens (player analysis/stats,
 * matchup grid, series overview, fearless draft/tree). Gives every screen the
 * same scale as the overview (a centred 1560×920 content column), a consistent
 * CI-branded title header with a accent accent, and the bottom-right
 * LeagueBroadcast/project logo lockup — so branding no longer lives in a bottom chip.
 */
import PostGameBrandBar from './PostGameBrandBar.vue'

defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <div class="pg-frame">
    <header v-if="title" class="frame-header">
      <span class="accent" />
      <div class="titles">
        <h1 class="frame-title">{{ title }}</h1>
        <span v-if="subtitle" class="frame-subtitle">{{ subtitle }}</span>
      </div>
      <div class="header-right">
        <slot name="header-right" />
      </div>
    </header>

    <div class="frame-body">
      <slot />
    </div>

    <footer class="frame-footer">
      <div class="footer-left">
        <slot name="footer-left" />
      </div>
      <PostGameBrandBar />
    </footer>
  </div>
</template>

<style scoped>
.pg-frame {
  position: relative;
  width: 1560px;
  height: 920px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ── Title header ── */
.frame-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.accent {
  width: 6px;
  align-self: stretch;
  min-height: 44px;
  border-radius: var(--radius-pill);
  background: var(--broadcast-accent);
  box-shadow: 0 0 16px color-mix(in oklab, var(--broadcast-accent) 60%, transparent);
}

.titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.frame-title {
  margin: 0;
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: white;
}

.frame-subtitle {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.5);
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}

/* ── Body ── */
.frame-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Footer / branding ── */
.frame-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.footer-left {
  display: flex;
  align-items: center;
  min-height: 46px;
}
</style>
