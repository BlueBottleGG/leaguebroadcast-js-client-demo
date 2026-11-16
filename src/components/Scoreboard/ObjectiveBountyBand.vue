<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  IngameObjectiveBountyState,
  IngameObjectiveBountyType,
  getObjectiveBountyRemaining,
  type ingameObjectiveBountyData,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import Tower from '@/assets/tower.png'
import Dragon from '@/assets/dragon/fire.png'
import Elder from '@/assets/dragon/elder.png'
import Herald from '@/assets/baron/herald.png'
import Baron from '@/assets/baron/baron.png'
import Grubs from '@/assets/grubs.png'
import Scuttle from '@/assets/scuttle.png'

const props = defineProps<{
  bounty: ingameObjectiveBountyData
  /** 1 blue, 2 red. */
  teamId: number
  gameTime: number
}>()

const CLAIM_MS = 1400
const TURRET_KEY = 'turret'
const TURRETS = new Set([
  IngameObjectiveBountyType.TurretPosition2,
  IngameObjectiveBountyType.TurretPosition3,
  IngameObjectiveBountyType.TurretPosition1Or4Or5,
])
const ICONS: Partial<Record<IngameObjectiveBountyType, string>> = {
  [IngameObjectiveBountyType.Dragon]: Dragon,
  [IngameObjectiveBountyType.ElderDragon]: Elder,
  [IngameObjectiveBountyType.RiftHerald]: Herald,
  [IngameObjectiveBountyType.Baron]: Baron,
  [IngameObjectiveBountyType.VoidGrubs]: Grubs,
  [IngameObjectiveBountyType.ScuttleCrab]: Scuttle,
}

const mirror = computed(() => props.teamId === 2)
const keyOf = (objective: IngameObjectiveBountyType) =>
  TURRETS.has(objective) ? TURRET_KEY : String(objective)

// The three turret categories share one entry at the highest turret reward.
const entries = computed(() => {
  const result: { key: string; icon: string; gold: number }[] = []
  let turretGold = 0
  for (const reward of props.bounty.rewards) {
    if (TURRETS.has(reward.objective)) turretGold = Math.max(turretGold, reward.gold)
    else if (ICONS[reward.objective])
      result.push({
        key: keyOf(reward.objective),
        icon: ICONS[reward.objective]!,
        gold: reward.gold,
      })
  }
  if (turretGold > 0) result.push({ key: TURRET_KEY, icon: Tower, gold: turretGold })
  return result.sort((a, b) => b.gold - a.gold)
})

const countdown = computed(() => {
  if (props.bounty.state !== IngameObjectiveBountyState.Upcoming) return undefined
  const s = Math.ceil(getObjectiveBountyRemaining(props.bounty, props.gameTime) ?? 0)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
})

const drainPercent = computed(() => {
  if (props.bounty.state !== IngameObjectiveBountyState.Ending) return undefined
  const total = props.bounty.endTime - props.bounty.startTime
  const left = getObjectiveBountyRemaining(props.bounty, props.gameTime) ?? 0
  return total > 0 ? Math.min(100, (left / total) * 100) : 0
})

const claims = ref(new Map<string, number>())
const timers = new Set<ReturnType<typeof setTimeout>>()
const unsub = useClient().onIngameEvents({
  onObjectiveBountyClaim(claim) {
    if (claim.teamId !== props.teamId) return
    const key = keyOf(claim.objective)
    claims.value = new Map(claims.value).set(key, claim.gold)
    const timer = setTimeout(() => {
      timers.delete(timer)
      const next = new Map(claims.value)
      next.delete(key)
      claims.value = next
    }, CLAIM_MS)
    timers.add(timer)
  },
})
onUnmounted(() => {
  unsub()
  timers.forEach(clearTimeout)
})
</script>

<template>
  <div class="bounty-band" :class="mirror ? 'red' : 'blue'">
    <span v-if="countdown" class="countdown">{{ countdown }}</span>
    <TransitionGroup name="bounty-entry">
      <span
        v-for="entry in entries"
        :key="entry.key"
        class="entry"
        :class="{ claimed: claims.has(entry.key) }"
      >
        <img :src="entry.icon" alt="" />
        {{ claims.has(entry.key) ? `+${claims.get(entry.key)}` : entry.gold }}
      </span>
    </TransitionGroup>
    <div v-if="drainPercent !== undefined" class="drain" :style="{ width: `${drainPercent}%` }" />
  </div>
</template>

<style scoped>
.bounty-band {
  --side: var(--blue-team-color);
  position: relative;
  height: 28px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  flex-wrap: wrap;
  box-sizing: border-box;
  color: #fff;
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-lg);
  box-shadow: inset 3px 0 0 var(--side);
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--side) 45%, var(--surface-strong)) 0%,
    var(--surface-strong) 55%
  );
}

.bounty-band.red {
  --side: var(--red-team-color);
  flex-direction: row-reverse;
  box-shadow: inset -3px 0 0 var(--side);
  background: linear-gradient(
    270deg,
    color-mix(in oklab, var(--side) 45%, var(--surface-strong)) 0%,
    var(--surface-strong) 55%
  );
}

.countdown,
.entry {
  font-size: 15px;
  font-weight: 800;
  line-height: 28px;
  white-space: nowrap;
}

.entry {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.entry img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.entry.claimed {
  animation: bounty-claim 1400ms ease-out;
}

.drain {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--side);
}

.red .drain {
  left: auto;
  right: 0;
}

@keyframes bounty-claim {
  0% {
    filter: brightness(1);
    transform: scale(1);
  }
  15% {
    filter: brightness(2.2);
    transform: scale(1.15);
  }
  40% {
    transform: scale(1);
  }
  100% {
    filter: brightness(1);
  }
}

.bounty-entry-enter-active,
.bounty-entry-leave-active {
  transition:
    opacity 250ms ease,
    transform 250ms ease;
}

.bounty-entry-enter-from,
.bounty-entry-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.bounty-entry-leave-active {
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  .entry.claimed {
    animation: none;
  }

  .bounty-entry-enter-from,
  .bounty-entry-leave-to {
    transform: none;
  }
}
</style>
