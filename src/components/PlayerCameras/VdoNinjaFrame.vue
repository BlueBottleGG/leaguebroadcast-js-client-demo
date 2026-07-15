<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { buildViewUrl, VIEW_IFRAME_ALLOW } from './vdoNinja'

/**
 * A VDO.Ninja view iframe that supervises its own connection.
 *
 * VDO.Ninja posts events to the parent window (iframe API,
 * https://docs.vdo.ninja/guides/iframe-api-documentation). We track the
 * `view-connection` events to know whether video is actually flowing and
 * recover stuck frames: first via the API `reload` command, then by
 * re-creating the iframe entirely, with exponential backoff. Without this a
 * failed ICE negotiation or a dropped signalling socket leaves a black box
 * in the OBS browser source until someone manually refreshes the source.
 */

const props = defineProps<{
  /** The raw stream URL as configured on the team member. */
  src: string
}>()

const emit = defineEmits<{
  /** Fired whenever the feed transitions between playing and not playing. */
  (e: 'connected', value: boolean): void
}>()

/** No `view-connection: true` within this window after load → recover. */
const CONNECT_TIMEOUT_MS = 20_000
/** Give vdo.ninja's own &autorecover a chance before we intervene. */
const DISCONNECT_GRACE_MS = 8_000
const BACKOFF_BASE_MS = 5_000
const BACKOFF_MAX_MS = 60_000

const frameEl = ref<HTMLIFrameElement | null>(null)
const frameKey = ref(0)
const connected = ref(false)
const recoverAttempts = ref(0)

const viewUrl = computed(() => buildViewUrl(props.src))

let watchdogTimer: number | null = null

function clearWatchdog() {
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer)
    watchdogTimer = null
  }
}

function setConnected(value: boolean) {
  if (connected.value === value) return
  connected.value = value
  emit('connected', value)
}

function armWatchdog(delayMs: number) {
  clearWatchdog()
  watchdogTimer = window.setTimeout(recover, delayMs)
}

function recover() {
  clearWatchdog()
  setConnected(false)
  recoverAttempts.value++

  if (recoverAttempts.value === 1 && frameEl.value?.contentWindow) {
    // Soft reload through the iframe API first — keeps the DOM node stable.
    frameEl.value.contentWindow.postMessage({ reload: true }, '*')
  } else {
    // Hard reset: re-create the iframe element.
    frameKey.value++
  }

  const backoff = Math.min(BACKOFF_BASE_MS * 2 ** recoverAttempts.value, BACKOFF_MAX_MS)
  armWatchdog(CONNECT_TIMEOUT_MS + backoff)
}

function onMessage(e: MessageEvent) {
  if (!frameEl.value || e.source !== frameEl.value.contentWindow) return
  const data = e.data
  if (typeof data !== 'object' || data === null) return

  if (data.action === 'view-connection') {
    if (data.value === true) {
      setConnected(true)
      recoverAttempts.value = 0
      clearWatchdog()
    } else {
      setConnected(false)
      armWatchdog(DISCONNECT_GRACE_MS)
    }
  } else if (data.action === 'video-element-created') {
    setConnected(true)
    recoverAttempts.value = 0
    clearWatchdog()
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  armWatchdog(CONNECT_TIMEOUT_MS)
})

// A new iframe element (hard reset or src change) restarts the watchdog.
watch([frameKey, () => props.src], () => {
  setConnected(false)
  armWatchdog(CONNECT_TIMEOUT_MS)
})

onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  clearWatchdog()
})

defineExpose({ connected })
</script>

<template>
  <iframe ref="frameEl" :key="frameKey" :src="viewUrl" :allow="VIEW_IFRAME_ALLOW" />
</template>
