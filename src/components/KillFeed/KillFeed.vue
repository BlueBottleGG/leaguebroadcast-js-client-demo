<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useClient } from '@/client'
import { useIsInGame } from '@/composables/useIngame'
import { type killFeedEvent } from '@bluebottle_gg/league-broadcast-client'
import KillFeedEntry from './KillFeedEntry.vue'

interface KillEntry extends killFeedEvent {
  id: number
}

const MAX_ENTRIES = 5
const DISPLAY_DURATION_MS = 6000
const STAGGER_STEP_MS = 100
/** Window within which consecutive events are considered simultaneous */
const BATCH_RESET_MS = 150

const client = useClient()
const isInGame = useIsInGame()

const entries = ref<KillEntry[]>([])
let nextId = 0
const timers = new Map<number, number>()
let batchCount = 0
let batchResetTimer: number | undefined

function addEntry(entry: KillEntry) {
  entries.value.push(entry)

  // Trim oldest entries beyond the cap, clearing their timers
  while (entries.value.length > MAX_ENTRIES) {
    const removed = entries.value.shift()!
    const t = timers.get(removed.id)
    if (t !== undefined) {
      clearTimeout(t)
      timers.delete(removed.id)
    }
  }

  // Auto-remove after display duration
  const timer = setTimeout(() => {
    const idx = entries.value.findIndex((e) => e.id === entry.id)
    if (idx > -1) entries.value.splice(idx, 1)
    timers.delete(entry.id)
  }, DISPLAY_DURATION_MS) as unknown as number

  timers.set(entry.id, timer)
}

const unsub = client.onIngameEvents({
  onKillFeedEvent(event: killFeedEvent) {
    // Stagger simultaneous events by delaying their insertion into the list
    clearTimeout(batchResetTimer)
    batchResetTimer = setTimeout(() => {
      batchCount = 0
    }, BATCH_RESET_MS) as unknown as number
    const delay = batchCount * STAGGER_STEP_MS
    batchCount++

    const entry: KillEntry = { ...event, id: nextId++ }
    setTimeout(() => addEntry(entry), delay)
  },
})

function onBeforeEnter(el: Element) {
  const wrapper = el as HTMLElement
  wrapper.style.opacity = '0'
  wrapper.style.transform = 'translateY(20px)'
}

function onEnter(el: Element, done: () => void) {
  const wrapper = el as HTMLElement
  wrapper.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out'
  void wrapper.offsetHeight
  wrapper.style.opacity = '1'
  wrapper.style.transform = 'translateY(0)'
  wrapper.addEventListener('transitionend', done, { once: true })
}

function onLeave(el: Element, done: () => void) {
  const wrapper = el as HTMLElement
  const entry = wrapper.firstElementChild as HTMLElement

  // Lock the wrapper's current height so we can animate it to 0,
  // smoothly closing the space for the remaining items.
  wrapper.style.height = `${wrapper.offsetHeight}px`
  wrapper.style.overflow = 'hidden'
  wrapper.style.transition = 'height 0.35s ease-out, margin-bottom 0.35s ease-out'

  // Slide the visible entry out independently.
  entry.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out'

  void wrapper.offsetHeight // force reflow before animating

  wrapper.style.height = '0'
  wrapper.style.marginBottom = '0'
  entry.style.opacity = '0'
  entry.style.transform = 'translateX(110%)'

  wrapper.addEventListener('transitionend', done, { once: true })
}

onUnmounted(() => {
  unsub()
  timers.forEach((t) => clearTimeout(t))
})
</script>

<template>
  <div v-if="isInGame" class="kill-feed">
    <TransitionGroup
      name="kill-feed"
      tag="div"
      class="kill-feed-list"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div v-for="entry in entries" :key="entry.id" class="entry-wrapper">
        <KillFeedEntry :event="entry" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style lang="css" scoped>
.kill-feed {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
}

.kill-feed-list {
  display: flex;
  flex-direction: column;
}

.entry-wrapper {
  margin-bottom: 4px;
}
</style>
