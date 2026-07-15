<script setup lang="ts">
import { computed } from 'vue'
import {
  buildGoldDiffSeries,
  formatGameClock,
  type postGameGoldGraph,
} from '@bluebottle_gg/league-broadcast-client'

const props = defineProps<{
  goldGraph?: postGameGoldGraph
  blueSide: number
  redSide: number
}>()

// Diff relative to the blue side so a positive value always reads as "blue
// ahead" regardless of numeric side-key ordering.
const series = computed(() => {
  const current = props.goldGraph?.current
  if (!current || !current.goldAtTime || Object.keys(current.goldAtTime).length === 0) return []
  return buildGoldDiffSeries(current, props.blueSide)
})

const hasData = computed(() => series.value.length >= 2)

const SVG_W = 900
const SVG_H = 200
const SVG_PAD = { top: 12, bottom: 22, left: 8, right: 8 }

const maxAbsDiff = computed(() => Math.max(...series.value.map((s) => Math.abs(s.diff)), 1000))

function point(index: number): { x: number; y: number } {
  const s = series.value
  const xScale = (SVG_W - SVG_PAD.left - SVG_PAD.right) / Math.max(s.length - 1, 1)
  const usableHalf = (SVG_H - SVG_PAD.top - SVG_PAD.bottom) / 2
  const midY = SVG_PAD.top + usableHalf
  const diff = s[index]?.diff ?? 0
  return {
    x: SVG_PAD.left + index * xScale,
    y: midY - (diff / maxAbsDiff.value) * usableHalf,
  }
}

const midY = computed(() => SVG_PAD.top + (SVG_H - SVG_PAD.top - SVG_PAD.bottom) / 2)

const linePath = computed(() => {
  const s = series.value
  if (!s.length) return ''
  return s
    .map((_, i) => {
      const { x, y } = point(i)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const areaAbovePath = computed(() => {
  const s = series.value
  if (!s.length) return ''
  // build the outline, clamping to the baseline wherever the diff dips below zero
  const pts = s.map((pt, i) => {
    const { x, y } = point(i)
    return { x, y: pt.diff > 0 ? y : midY.value }
  })
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${line} L${last?.x.toFixed(1)},${midY.value} L${first?.x.toFixed(1)},${midY.value} Z`
})

const areaBelowPath = computed(() => {
  const s = series.value
  if (!s.length) return ''
  const pts = s.map((pt, i) => {
    const { x, y } = point(i)
    return { x, y: pt.diff < 0 ? y : midY.value }
  })
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${line} L${last?.x.toFixed(1)},${midY.value} L${first?.x.toFixed(1)},${midY.value} Z`
})

// x-axis ticks every 5 minutes
const timeAxisLabels = computed(() => {
  const s = series.value
  if (s.length < 2) return []
  const tStart = s[0]?.time ?? 0
  const tEnd = s[s.length - 1]?.time ?? 0
  const labels: { x: number; text: string }[] = []
  const STEP = 300 // 5 min
  const xScale = (SVG_W - SVG_PAD.left - SVG_PAD.right) / Math.max(tEnd - tStart, 1)
  for (let t = tStart; t <= tEnd + 0.001; t += STEP) {
    labels.push({ x: SVG_PAD.left + (t - tStart) * xScale, text: formatGameClock(t) })
  }
  return labels
})

const maxLabel = computed(() => {
  const k = maxAbsDiff.value / 1000
  return `+${k.toFixed(1)}k`
})
</script>

<template>
  <div class="pg-gold">
    <div class="panel-header">
      <span class="panel-title">Gold Difference Over Time</span>
      <span v-if="hasData" class="axis-max">{{ maxLabel }}</span>
    </div>

    <svg v-if="hasData" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="chart-svg">
      <path :d="areaAbovePath" fill="var(--blue-team-color)" fill-opacity="0.25" />
      <path :d="areaBelowPath" fill="var(--red-team-color)" fill-opacity="0.25" />

      <line
        :x1="SVG_PAD.left"
        :x2="SVG_W - SVG_PAD.right"
        :y1="midY"
        :y2="midY"
        stroke="rgba(255,255,255,0.25)"
        stroke-width="1"
        stroke-dasharray="4 4"
      />

      <path
        :d="linePath"
        fill="none"
        stroke="#ffffff"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <text
        v-for="label in timeAxisLabels"
        :key="label.text"
        :x="label.x"
        :y="SVG_H - 4"
        text-anchor="middle"
        class="axis-label"
      >
        {{ label.text }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.pg-gold {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 26px;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 17px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: white;
}

.axis-max {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
}

.chart-svg {
  width: 100%;
  height: 190px;
}

.axis-label {
  fill: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 400;
}
</style>
