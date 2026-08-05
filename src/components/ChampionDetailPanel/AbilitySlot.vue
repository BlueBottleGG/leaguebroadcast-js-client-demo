<script setup lang="ts">
import { computed } from 'vue'
import type { ingameAbilityInfo } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import SpellWithCooldown from '../PlayerScoreboard/SpellWithCooldown.vue'

const props = withDefaults(
  defineProps<{
    ability?: ingameAbilityInfo
    /** Show the skill-point/level badge (Q/W/E/R). Summoner spells are always "skilled". */
    showLevel?: boolean
    /** Border/accent variant. */
    variant?: 'ability' | 'summoner'
  }>(),
  {
    showLevel: false,
    variant: 'ability',
  },
)

const client = useClient()

const skilled = computed(() => props.variant === 'summoner' || (props.ability?.level ?? 0) > 0)
const hasCharges = computed(() => (props.ability?.charges ?? 0) > 0)
</script>

<template>
  <div class="ability-slot" :class="variant">
    <SpellWithCooldown
      class="ability-slot-icon"
      :ready-at="ability?.readyAt"
      :total-cooldown="ability?.totalCooldown"
      :img="client.getCacheUrl(ability?.assets?.iconAsset)"
      show-timer
      :skilled="skilled"
      dim-unskilled
    />
    <span class="charge-badge" v-if="hasCharges">{{ ability?.charges }}</span>
    <span class="level-badge" v-if="showLevel && (ability?.level ?? 0) > 0">{{
      ability?.level
    }}</span>
  </div>
</template>

<style lang="css" scoped>
.ability-slot {
  position: relative;
  width: 30px;
  height: 30px;
  border: 1px solid #3a3f45;
  border-radius: 3px;
  overflow: visible;
  background: #0c0f0d;
}

.ability-slot.summoner {
  border-color: #4f8fe0;
}

.ability-slot-icon {
  width: 100%;
  height: 100%;
}

.level-badge,
.charge-badge {
  position: absolute;
  bottom: -5px;
  min-width: 12px;
  padding: 0 2px;
  text-align: center;
  background: rgba(10, 12, 10, 0.85);
  font-size: 10px;
  line-height: 13px;
  color: #f2ead7;
}

.level-badge {
  right: -5px;
  border-top-left-radius: 3px;
}

/* Charges share the corner with the level badge on ability slots (ammo-based
   abilities are rare and both badges are small); pin charges to the opposite
   corner so they never visually collide. */
.charge-badge {
  left: 0;
  border-top-right-radius: 3px;
}
</style>
