<script setup lang="ts">
import type { ObjectDirective } from 'vue'
import {
  formatDamage,
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
} from '@bluebottle_gg/league-broadcast-client'
import type { DamageFlowDamageTypes } from './damageFlowData'

defineProps<{ values: DamageFlowDamageTypes | null; total: number | null; muted?: boolean }>()
const colors = [PHYS_COLOR, MAGIC_COLOR, TRUE_COLOR, '#74808d']
const observers = new WeakMap<HTMLElement, ResizeObserver>()

function fitLabel(label: HTMLElement) {
  const segment = label.parentElement!
  const style = getComputedStyle(label)
  const horizontalMargins = parseFloat(style.marginLeft) + parseFloat(style.marginRight)
  const verticalMargins = parseFloat(style.marginTop) + parseFloat(style.marginBottom)
  label.style.visibility =
    segment.clientWidth >= label.offsetWidth + horizontalMargins &&
    segment.clientHeight >= label.offsetHeight + verticalMargins
      ? 'visible'
      : 'hidden'
}

// Observe the actual font and segment widths, including while the bar grows.
const vFit: ObjectDirective<HTMLElement> = {
  mounted(label) {
    const observer = new ResizeObserver(() => fitLabel(label))
    observer.observe(label)
    observer.observe(label.parentElement!)
    observers.set(label, observer)
    fitLabel(label)
  },
  updated: fitLabel,
  unmounted(label) {
    observers.get(label)?.disconnect()
    observers.delete(label)
  },
}
</script>

<template>
  <span class="damage-segments">
    <template v-for="(value, index) in values" :key="index">
      <span
        v-if="value > 0 && total"
        class="type-segment"
        :class="{ 'true-damage': index === 2 }"
        :style="{
          width: `${(value / total) * 100}%`,
          background: muted ? `color-mix(in srgb, ${colors[index]} 45%, #040508)` : colors[index],
        }"
      >
        <span v-fit class="segment-value">{{ formatDamage(value) }}</span>
      </span>
    </template>
  </span>
</template>

<style scoped>
.damage-segments {
  display: flex;
  width: 100%;
  height: 100%;
}
.type-segment {
  display: flex;
  flex: none;
  align-items: flex-end;
  justify-content: flex-end;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}
.type-segment:last-child .segment-value {
  margin-right: calc(6px + var(--arrow-tip-space, 0px));
}
.segment-value {
  flex: none;
  margin: 0 6px 1px;
  visibility: hidden;
  color: rgb(255 255 255 / 0.8);
  font-size: 16px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  white-space: nowrap;
}
.true-damage .segment-value {
  color: rgb(0 0 0 / 0.85);
}
</style>
