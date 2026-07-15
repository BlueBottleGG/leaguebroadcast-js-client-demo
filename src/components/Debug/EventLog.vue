<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useClient } from '@/client'
import type { playerUpdateEvent } from '@bluebottle_gg/league-broadcast-client'
import { useEventLogStore } from '@/stores/eventLogStore'

const eventLogStore = useEventLogStore()

function add(text: string) {
  eventLogStore.addEntry(text)
}

const client = useClient()

// Subscribe to various game events to populate the log
const unsubEvents = [
  client.onIngameConnect(() => add('🟢 Connected to in-game WebSocket')),
  client.onIngameDisconnect(() => add('🔴 Disconnected from in-game WebSocket')),
]

client.onIngameEvents({
  onObjectiveEvent: (e) => add(`🎯 ${e.objective} (${e.eventType}) — Team ${e.team}`),
  onKillFeedEvent: (e) => add(`⚔️ ${e.killer?.name ?? '???'} → ${e.victim?.name ?? '???'}`),
  onPlayerEvent: onPlayerEvent,
})

function onPlayerEvent(e: playerUpdateEvent) {
  if (e.boughtItems) {
    e.boughtItems.forEach((i) => add(`🛒 ${e.playerNameAndTagLine} bought ${i.displayName}`))
  }
  if (e.levelUp) {
    add(`⬆️ ${e.playerNameAndTagLine} leveled up to ${e.levelUp[0]}`)
  }
  if (e.soldOrConsumedItems) {
    e.soldOrConsumedItems.forEach((i) =>
      add(`🗑️ ${e.playerNameAndTagLine} sold/consumed ${i.displayName}`),
    )
  }
}

onUnmounted(() => unsubEvents.forEach((u) => u()))
</script>

<template>
  <div class="event-log">
    <h3 class="title">Event Log</h3>
    <div class="entries">
      <p v-if="eventLogStore.recentEntries.length === 0" class="placeholder">No events yet…</p>
      <div v-for="entry in eventLogStore.recentEntries" :key="entry.id" class="entry">
        <span class="entry-time">{{ entry.time }}</span>
        <span>{{ entry.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-log {
  background: rgba(0, 0, 0, 0.85);
  border-radius: var(--radius-lg);
  padding: 1rem 1.5rem;
  color: #fff;
  max-height: 300px;
  overflow-y: auto;
}

.title {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #ccc;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.entry {
  font-size: 0.8rem;
  display: flex;
  gap: 0.75rem;
}

.entry-time {
  color: #888;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.placeholder {
  color: #888;
  font-style: italic;
  margin: 0;
}
</style>
