<script setup lang="ts">
import broadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'
import { useEventBranding } from '@/composables/useEventBranding'

const { eventLogoUrl, eventName } = useEventBranding()
</script>

<template>
  <div class="brand-lockup">
    <img
      v-if="eventLogoUrl"
      class="event-logo"
      :src="eventLogoUrl"
      :alt="eventName ? `${eventName} logo` : 'Event logo'"
    />
    <span v-if="eventLogoUrl" class="rule" />
    <img class="project-logo" :src="broadcastLogo" alt="League Broadcast" />
  </div>
</template>

<style scoped>
.brand-lockup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
}

/* explicit heights — marks render at fixed size, never intrinsic scale */
.event-logo {
  height: 40px;
  width: auto;
}

.project-logo {
  height: 46px;
  width: auto;
}

.rule {
  width: 1px;
  height: 40px;
  background: rgb(255 255 255 / 0.2);
}
</style>
