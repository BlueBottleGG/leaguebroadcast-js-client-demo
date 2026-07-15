<script setup lang="ts">
import { GameState } from '@bluebottle_gg/league-broadcast-client'
import { useIngameConnected, useGameState } from '@/composables/useIngame'

const connected = useIngameConnected()
const gameState = useGameState()

const stateLabels: Record<GameState, string> = {
  [GameState.OutOfGame]: 'Out of Game',
  [GameState.Loading]: 'Loading',
  [GameState.Running]: 'Live',
  [GameState.Paused]: 'Paused',
  [GameState.Mocking]: 'Mock / Replay',
  [GameState.GameOver]: 'Game Over',
  [GameState.ChampionSelect]: 'Champion Select',
}
</script>

<template>
  <div class="status" :class="{ connected, disconnected: !connected }">
    <span class="dot" />
    <span v-if="connected"> Connected — {{ stateLabels[gameState] ?? 'Unknown' }} </span>
    <span v-else>Disconnected — waiting for LeagueBroadcast server…</span>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  background: rgba(0, 0, 0, 0.7);
  color: #ccc;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.connected .dot {
  background: #22c55e;
}

.disconnected .dot {
  background: #ef4444;
}
</style>
