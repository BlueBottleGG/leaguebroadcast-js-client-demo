<script setup lang="ts">
import { computed } from 'vue'
import {
  Team,
  type ingameSideInfoPageDisplayData,
  type ingameSideInfoPageRow,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import { playerDisplayName } from '@/utils/playerDisplayName'

const props = defineProps<{
  row: ingameSideInfoPageRow
  display?: ingameSideInfoPageDisplayData
  rank: number
}>()

const client = useClient()

const shortName = computed(() => playerDisplayName(props.row, 'Unknown'))
const teamClass = computed(() => (props.row.team === Team.Chaos ? 'is-chaos' : 'is-order'))
const showHero = computed(() => props.display?.showHero !== false)
const showBar = computed(() => props.display?.showBar !== false)
const showCurValue = computed(() => props.display?.showCurValue !== false)
const showMinValue = computed(() => props.display?.showMinValue === true)
const showMaxValue = computed(() => props.display?.showMaxValue === true)

const championImg = computed(() => {
  const img = props.row.champion?.squareImg
  return img ? client.getCacheUrl(img) : ''
})

const valueForDisplay = computed(() => {
  if (props.row.displayValue !== null && props.row.displayValue !== undefined) {
    return props.row.displayValue
  }
  return props.row.curValue ?? 0
})

const valueText = computed(() => {
  const value = valueForDisplay.value
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const formatted =
    abs >= 1000 ? `${sign}${(abs / 1000).toFixed(1)}K` : Math.trunc(value).toString()
  return `${formatted}${props.row.displayValueSuffix ?? ''}`
})
const valueFontSize = computed(() => {
  const length = valueText.value.length
  if (length <= 2) return '19px'
  if (length <= 3) return '17px'
  if (length <= 4) return '14px'
  if (length <= 5) return '12px'
  return '10px'
})

const minText = computed(() => formatPlainValue(props.row.minValue))
const maxText = computed(() => formatPlainValue(props.row.maxValue))

const fillPercent = computed(() => {
  const cur = props.row.curValue ?? 0
  const min = props.row.minValue ?? 0
  const max = props.row.maxValue ?? 0
  if (max <= min) return cur > 0 ? 100 : 0
  return Math.max(0, Math.min(100, ((cur - min) / (max - min)) * 100))
})

function formatPlainValue(value: number | undefined): string {
  if (value === undefined) return ''
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(1)}K` : Math.trunc(value).toString()
}
</script>

<template>
  <div
    class="side-info-row"
    :class="[
      teamClass,
      {
        'without-hero': !showHero,
        'without-bar': !showBar,
        'without-value': !showCurValue,
      },
    ]"
  >
    <div v-if="showHero" class="champion-frame">
      <img
        v-if="championImg"
        :src="championImg"
        :alt="shortName"
        class="champion-img"
        @error="handleImageError"
        @load="handleImageLoad"
      />
      <span v-else class="champion-fallback">{{ rank + 1 }}</span>
    </div>

    <div class="row-main">
      <div class="row-topline">
        <span class="player-name">{{ shortName }}</span>
        <span v-if="showCurValue" class="inline-value">{{ valueText }}</span>
      </div>

      <div v-if="showBar" class="bar-shell">
        <div class="bar-fill" :style="{ width: `${fillPercent}%` }"></div>
      </div>

      <div v-if="showMinValue || showMaxValue" class="range-labels">
        <span>{{ showMinValue ? minText : '' }}</span>
        <span>{{ showMaxValue ? maxText : '' }}</span>
      </div>
    </div>

    <div v-if="showCurValue" class="value-box">
      <span :style="{ fontSize: valueFontSize }">{{ valueText }}</span>
    </div>
  </div>
</template>

<style scoped>
.side-info-row {
  --team-color: var(--blue-team-color);
  --team-color-soft: color-mix(in oklab, var(--team-color) 42%, transparent);
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  color: white;
  font-family: 'Bebas Neue', Arial, sans-serif;
  contain: layout paint;
}

.side-info-row.is-chaos {
  --team-color: var(--red-team-color);
}

.side-info-row.without-hero {
  grid-template-columns: minmax(0, 1fr) 40px;
}

.side-info-row.without-value {
  grid-template-columns: 38px minmax(0, 1fr);
}

.side-info-row.without-hero.without-value {
  grid-template-columns: minmax(0, 1fr);
}

.champion-frame {
  width: 38px;
  height: 38px;
  overflow: hidden;
  background: #101318;
  border: 1px solid var(--team-color-soft);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

.champion-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.champion-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: rgb(255 255 255 / 0.42);
  font-size: 14px;
  font-weight: 800;
}

.row-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.player-name {
  min-width: 0;
  overflow: hidden;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-value {
  display: none;
  color: rgb(255 255 255 / 0.72);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.bar-shell {
  width: 100%;
  height: 9px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02)), var(--team-color-soft);
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: var(--radius-xs);
}

.bar-fill {
  height: 100%;
  min-width: 2px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--team-color) 78%, white),
    var(--team-color)
  );
  box-shadow: 0 0 10px color-mix(in oklab, var(--team-color) 45%, transparent);
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  color: rgb(255 255 255 / 0.42);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.value-box {
  width: 40px;
  height: 32px;
  display: grid;
  place-items: center;
  align-self: end;
  color: white;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent), rgb(0 0 0 / 0.42);
  border: 1px solid var(--team-color-soft);
  border-radius: var(--radius-sm);
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.value-box span {
  max-width: 36px;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
}

.side-info-row.without-bar .inline-value {
  display: inline;
}

.side-info-row.without-bar .value-box {
  display: none;
}
</style>
