<script setup lang="ts">
import { useIngameSelector } from '@/composables/useIngame'
import BlueBottleLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import FadeTransition from '../../transitions/FadeTransition.vue'
import { useClient } from '@/client'

const client = useClient()
const patch = useIngameSelector((s) => s.gameData.patch)
const shortPatch = computed(() => patch.value?.split('.').slice(0, 2).join('.') || '')
const otherInfo = ['LEAGUE BROADCAST']
const matchName = ref<string | null>(null)
const allInfo = computed(() => [
  ...otherInfo,
  ...(matchName.value ? [matchName.value] : []),
  `PATCH ${shortPatch.value}`,
])

const currentInfoIndex = ref(0)
const currentInfo = computed(() => allInfo.value[currentInfoIndex.value] ?? '')
const infoRotationInterval = 15000 // Rotate info every 15 seconds
const rotationTimer = ref<number | null>(null)

onMounted(async () => {
  rotationTimer.value = setInterval(() => {
    currentInfoIndex.value = (currentInfoIndex.value + 1) % allInfo.value.length
  }, infoRotationInterval)

  try {
    const match = await client.api.match.getCurrentMatch()
    matchName.value = match?.name?.trim() || null
  } catch {
    // No match configured on the backend — rotation just skips the match name.
  }
})

onUnmounted(() => {
  if (rotationTimer.value !== null) {
    clearInterval(rotationTimer.value)
  }
})
</script>

<template>
  <div class="flex flex-row justify-between items-center pl-2.5 pr-10 py-0.5 w-full h-full">
    <BlueBottleLogo class="h-7" aria-label="BlueBottle" />
    <div class="info-text-slot">
      <FadeTransition mode="out-in">
        <span :key="currentInfoIndex" class="patch-text">{{ currentInfo }}</span>
      </FadeTransition>
    </div>
  </div>
</template>

<style lang="css" scoped>
.info-text-slot {
  display: grid;
  justify-items: end;
  align-items: center;
  overflow: hidden;
}

.patch-text {
  grid-area: 1 / 1;
  color: white;
  font-size: 20px;
  line-height: 1;
  font-weight: 800;
  font-weight: bold;
  white-space: nowrap;
}
</style>
