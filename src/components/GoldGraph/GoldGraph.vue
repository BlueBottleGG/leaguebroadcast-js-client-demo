<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useIngameSelector } from '../../composables/useIngame'
import { useClient } from '@/client'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import SlideTransition from '@/transitions/SlideTransition.vue'
import { buildGoldHistorySeries } from './goldGraphHistory'

const client = useClient()
const scoreboard = useIngameSelector((s) => s.gameData.scoreboard)
const blueTeam = computed(() => scoreboard.value?.teams[0])
const redTeam = computed(() => scoreboard.value?.teams[1])

const goldGraph = useIngameSelector((s) => s.gameData.goldGraph)
const previousSeries = computed(() => {
  const graph = goldGraph.value
  if (!graph?.showPreviousGames) return []
  return buildGoldHistorySeries(graph.current, graph.previousGames)
})

/**
 * Parse the gold data into a per-team gold-difference series suitable for SVG rendering.
 * `goldAtTime` is keyed by game-time (seconds), each value is a map of teamId → gold.
 */
const series = computed(() => {
  const current = goldGraph.value?.current
  if (!current?.goldAtTime) return null

  const entries = Object.entries(current.goldAtTime)
    .map(([time, teams]) => ({ time: Number(time), teams }))
    .sort((a, b) => a.time - b.time)

  if (entries.length < 2) return null

  // Team IDs from the data (usually 0 and 1)
  const teamIds = Object.keys(entries[0]?.teams ?? {})
    .map(Number)
    .sort((a, b) => a - b)
  if (teamIds.length < 2) return null

  const [t0, t1] = teamIds
  const teamNames = current.teams ?? {}

  //prevent undefined t0 or t1 by defaulting to 0
  if (t0 === undefined || isNaN(t0) || t1 === undefined || isNaN(t1)) {
    console.warn('Invalid team IDs in gold graph data, defaulting to 0 and 1')
    return null
  }

  // Compute gold difference: positive = team 0 ahead
  const points = entries.map((e) => ({
    time: e.time,
    diff: (e.teams[t0] ?? 0) - (e.teams[t1] ?? 0),
  }))

  const historicalPoints = previousSeries.value.flatMap((game) => game.points)
  const maxTime = Math.max(
    points[points.length - 1]?.time ?? 0,
    ...historicalPoints.map((point) => point.time),
  )
  const maxAbsDiff = Math.max(
    ...points.map((point) => Math.abs(point.diff)),
    ...historicalPoints.map((point) => Math.abs(point.diff)),
    1,
  )

  return { points, maxTime, maxAbsDiff, teamNames, teamIds: [t0, t1] as const }
})

/**
 * Stable display series — only updated when the data meaningfully changes.
 * Prevents all downstream computeds from re-running every 0.5 s tick when
 * the server sends an identical snapshot.
 */
const displaySeries = ref<typeof series.value>(null)

/**
 * Animation state. The graph animates only when displaySeries actually
 * changes (identical 2×/s snapshots are filtered out by the watcher below):
 *  • scale tween — maxTime/maxAbsDiff ease toward their new values, so the
 *    existing line compresses/rescales smoothly instead of jumping
 *  • reveal tween — points appended by the update draw in from the previous
 *    endpoint, extending the line, fills and colored segments together
 * Both run off one eased clock, which keeps the growing tip pinned to the
 * right edge while the rest of the graph compresses beneath it.
 */
const ANIM_MS = 600
const animScale = ref({ maxTime: 1, maxAbsDiff: 1 })
/** 0→1 draw-in progress of the points appended by the latest update. */
const reveal = ref(1)
/** Number of points that were already fully visible before the update. */
let revealBase = 0
let rafId = 0

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function startTween(to: { maxTime: number; maxAbsDiff: number }, withReveal: boolean) {
  cancelAnimationFrame(rafId)
  const from = { ...animScale.value }
  reveal.value = withReveal ? 0 : 1
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - t0) / ANIM_MS, 1)
    const e = easeOutCubic(t)
    animScale.value = {
      maxTime: from.maxTime + (to.maxTime - from.maxTime) * e,
      maxAbsDiff: from.maxAbsDiff + (to.maxAbsDiff - from.maxAbsDiff) * e,
    }
    if (withReveal) reveal.value = e
    if (t < 1) rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}

onUnmounted(() => cancelAnimationFrame(rafId))

watch(
  series,
  (next) => {
    if (!next) {
      displaySeries.value = null
      cancelAnimationFrame(rafId)
      return
    }
    const prev = displaySeries.value
    const changed =
      !prev ||
      prev.points.length !== next.points.length ||
      prev.maxTime !== next.maxTime ||
      prev.maxAbsDiff !== next.maxAbsDiff ||
      prev.points.at(-1)?.diff !== next.points.at(-1)?.diff

    if (!changed) return

    const snap = () => {
      cancelAnimationFrame(rafId)
      revealBase = next.points.length
      animScale.value = { maxTime: next.maxTime, maxAbsDiff: next.maxAbsDiff }
      reveal.value = 1
    }

    if (
      prev &&
      next.points.length > prev.points.length &&
      next.points[prev.points.length - 1]?.time === prev.points.at(-1)?.time
    ) {
      // Appended points: same history plus new samples — draw them in
      revealBase = prev.points.length
      displaySeries.value = next
      startTween({ maxTime: next.maxTime, maxAbsDiff: next.maxAbsDiff }, true)
    } else if (prev && next.points.length === prev.points.length) {
      // In-place revision (e.g. latest sample updated): rescale smoothly
      revealBase = next.points.length
      displaySeries.value = next
      startTween({ maxTime: next.maxTime, maxAbsDiff: next.maxAbsDiff }, false)
    } else {
      // First load or a series reset — snap without animation
      displaySeries.value = next
      snap()
    }
  },
  { immediate: true },
)

// SVG viewBox dimensions — wide and short for a broadcast bar
const WIDTH = 700
const HEIGHT = 175
const PADDING_X = 5
const GRAPH_TOP = 10
const GRAPH_BOTTOM = 150
const MID_Y = (GRAPH_TOP + GRAPH_BOTTOM) / 2
const GRAPH_HEIGHT = GRAPH_BOTTOM - GRAPH_TOP

/** Map a data point to SVG coordinates. */
function toSvg(
  time: number,
  diff: number,
  maxTime: number,
  maxAbsDiff: number,
): { x: number; y: number } {
  const x = PADDING_X + (time / maxTime) * (WIDTH - 2 * PADDING_X)
  const y = MID_Y - (diff / maxAbsDiff) * (GRAPH_HEIGHT / 2)
  return { x, y }
}

/** Completed games share this chart's time/gold scale and stop at their own final sample. */
const previousLines = computed(() => {
  const { maxTime, maxAbsDiff } = animScale.value
  return previousSeries.value.flatMap((game, index) => {
    const points = game.points.map((point) => ({
      ...toSvg(point.time, point.diff, maxTime, maxAbsDiff),
      diff: point.diff,
    }))
    const last = points.at(-1)
    if (!last) return []

    const nearRightEdge = last.x > WIDTH - 95
    const winnerTag =
      (game.winnerSide === 'blue' ? blueTeam.value?.teamTag : redTeam.value?.teamTag) ||
      game.winnerName
    const labelOffset = (index % 2) * 9
    const labelY = Math.max(
      GRAPH_TOP + 9,
      Math.min(
        GRAPH_BOTTOM - 3,
        last.y + (game.winnerSide === 'blue' ? -5 - labelOffset : 11 + labelOffset),
      ),
    )

    return [
      {
        key: `game-${game.gameNumber}`,
        d: points
          .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${point.x},${point.y}`)
          .join(' '),
        end: last,
        color: game.winnerSide === 'blue' ? 'var(--blue-team-color)' : 'var(--red-team-color)',
        label: `G${game.gameNumber} · ${winnerTag.toUpperCase()} WON`,
        labelX: last.x + (nearRightEdge ? -4 : 4),
        labelY,
        textAnchor: nearRightEdge ? 'end' : 'start',
      },
    ]
  })
})

/**
 * Points currently rendered, in SVG coordinates (plus the data diff for
 * segment coloring). Uses the animated scale, and while a reveal tween is
 * running, ends in an interpolated "tip" partway along the newest segment
 * so the line, fills and colors all grow together.
 */
const renderPoints = computed(() => {
  const s = displaySeries.value
  if (!s) return []
  const { maxTime, maxAbsDiff } = animScale.value
  const pts = s.points
  const appended = pts.length - revealBase
  let count = pts.length
  let tip: { time: number; diff: number } | null = null
  if (appended > 0 && reveal.value < 1) {
    const pos = reveal.value * appended
    const full = Math.floor(pos)
    const frac = pos - full
    count = revealBase + full
    const a = pts[count - 1]
    const b = pts[count]
    if (a && b) {
      tip = {
        time: a.time + (b.time - a.time) * frac,
        diff: a.diff + (b.diff - a.diff) * frac,
      }
    }
  }
  const out = pts
    .slice(0, count)
    .map((p) => ({ ...toSvg(p.time, p.diff, maxTime, maxAbsDiff), diff: p.diff }))
  if (tip) out.push({ ...toSvg(tip.time, tip.diff, maxTime, maxAbsDiff), diff: tip.diff })
  return out
})

/** Build an SVG path string from the gold-difference points. */
const pathD = computed(() => {
  const pts = renderPoints.value
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
})

/**
 * Build a fill path for one side of the zero line.
 * Inserts interpolated zero-crossing points so the fill edge
 * matches the actual data line exactly where it crosses MID_Y.
 */
function buildFillPath(pts: Array<{ x: number; y: number }>, side: 'blue' | 'red'): string {
  if (pts.length === 0) return ''
  const clamp =
    side === 'blue' ? (y: number) => Math.min(y, MID_Y) : (y: number) => Math.max(y, MID_Y)

  const segments: string[] = []

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]!

    // Check for a zero crossing between previous and current point
    if (i > 0) {
      const prev = pts[i - 1]!
      if ((prev.y < MID_Y && curr.y > MID_Y) || (prev.y > MID_Y && curr.y < MID_Y)) {
        const t = (MID_Y - prev.y) / (curr.y - prev.y)
        const crossX = prev.x + t * (curr.x - prev.x)
        segments.push(`L${crossX},${MID_Y}`)
      }
    }

    const cy = clamp(curr.y)
    segments.push(`${i === 0 ? 'M' : 'L'}${curr.x},${cy}`)
  }

  // Close back along the zero line
  const lastX = pts[pts.length - 1]!.x
  const firstX = pts[0]!.x
  segments.push(`L${lastX},${MID_Y} L${firstX},${MID_Y} Z`)
  return segments.join(' ')
}

const fillPathBlue = computed(() => buildFillPath(renderPoints.value, 'blue'))
const fillPathRed = computed(() => buildFillPath(renderPoints.value, 'red'))

/**
 * Split the line into colored segments: blue when team 0 leads, red otherwise.
 * Inserts interpolated crossing points so each segment starts/ends exactly on MID_Y.
 */
const coloredSegments = computed(() => {
  const pts = renderPoints.value
  if (pts.length === 0) return []

  const out: Array<{ d: string; color: string }> = []
  let color = pts[0]!.diff >= 0 ? 'blue' : 'red'
  let seg: string[] = [`M${pts[0]!.x},${pts[0]!.y}`]

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const curr = pts[i]!
    const pd = prev.diff
    const cd = curr.diff

    if (pd >= 0 !== cd >= 0) {
      const t = pd / (pd - cd)
      const cx = prev.x + t * (curr.x - prev.x)
      seg.push(`L${cx},${MID_Y}`)
      out.push({ d: seg.join(' '), color })
      color = cd >= 0 ? 'blue' : 'red'
      seg = [`M${cx},${MID_Y}`]
    }

    seg.push(`L${curr.x},${curr.y}`)
  }

  if (seg.length > 1) out.push({ d: seg.join(' '), color })
  return out
})

function formatGoldShort(val: number): string {
  // Round first so float data never leaks into the label ("+999.6" → "+1.0k")
  const rounded = Math.round(val)
  if (rounded === 0) return '0'
  const sign = rounded > 0 ? '+' : '-'
  const abs = Math.abs(rounded)
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return `${sign}${abs}`
}

/**
 * Scale labels: max gold advantage at top (blue) and bottom (red).
 * Reads the animated scale so the numbers tick up along with the rescale.
 */
const scaleLabels = computed(() => {
  if (!displaySeries.value) return { top: '', bottom: '' }
  const max = animScale.value.maxAbsDiff
  return {
    top: formatGoldShort(max),
    bottom: formatGoldShort(-max),
  }
})

/** Notable local extrema — significant, well-spaced peaks/valleys. */
const notableExtrema = computed(() => {
  if (!displaySeries.value) return []
  const { points, maxTime, maxAbsDiff } = displaySeries.value
  if (points.length < 3) return []

  /**
   * Compress consecutive (near-)equal values into runs so flat plateaus —
   * common with float data that repeats — register as a single extremum
   * instead of slipping through strict </> comparisons.
   */
  const EPS = 1e-6
  const runs: Array<{ value: number; startIdx: number; endIdx: number }> = []
  for (let i = 0; i < points.length; i++) {
    const v = points[i]!.diff
    const last = runs[runs.length - 1]
    if (last && Math.abs(v - last.value) < EPS) last.endIdx = i
    else runs.push({ value: v, startIdx: i, endIdx: i })
  }

  /**
   * Topographic prominence of the run at index r: how far the peak/valley
   * stands out before being "absorbed" by a higher peak / deeper valley.
   *
   * For a peak of value v, scan each side until a run strictly exceeds v and
   * track the lowest value (the "col") passed on the way:
   *   - Both sides hit higher terrain → prominence = v − max(leftCol, rightCol)
   *   - Only one side does → prominence = v − that side's col
   *   - Neither does (global max, incl. the series endpoint) →
   *     prominence = v − min over both sides
   * Valleys use the same logic inverted. Unlike the previous version this
   * gives endpoints and one-sided peaks a real prominence instead of 0,
   * so a graph still rising at the right edge gets its maximum labeled.
   */
  function computeProminence(r: number, isMax: boolean): number {
    const v = runs[r]!.value
    const sign = isMax ? 1 : -1
    let leftCol = v
    let leftHigher = false
    for (let i = r - 1; i >= 0; i--) {
      const d = runs[i]!.value
      if (sign * d > sign * v) {
        leftHigher = true
        break
      }
      if (sign * d < sign * leftCol) leftCol = d
    }
    let rightCol = v
    let rightHigher = false
    for (let i = r + 1; i < runs.length; i++) {
      const d = runs[i]!.value
      if (sign * d > sign * v) {
        rightHigher = true
        break
      }
      if (sign * d < sign * rightCol) rightCol = d
    }
    let col: number
    if (leftHigher && rightHigher)
      col = isMax ? Math.max(leftCol, rightCol) : Math.min(leftCol, rightCol)
    else if (leftHigher) col = leftCol
    else if (rightHigher) col = rightCol
    else col = isMax ? Math.min(leftCol, rightCol) : Math.max(leftCol, rightCol)
    return sign * (v - col)
  }

  const minProminence = Math.max(300, maxAbsDiff * 0.1)
  const minSpacing = (WIDTH - 2 * PADDING_X) * 0.1

  const candidates: Array<{
    x: number
    time: number
    diff: number
    prominence: number
    isLast: boolean
  }> = []

  for (let r = 0; r < runs.length; r++) {
    const v = runs[r]!.value
    // Values that round to 0 would label as "0" — never notable
    if (Math.abs(v) < 0.5) continue
    const prev = runs[r - 1]?.value
    const next = runs[r + 1]?.value
    // Endpoints count: a missing neighbor doesn't disqualify an extremum
    const isMax = (prev === undefined || prev < v) && (next === undefined || next < v)
    const isMin = (prev === undefined || prev > v) && (next === undefined || next > v)
    if (!isMax && !isMin) continue

    const prominence = computeProminence(r, isMax)
    if (prominence < minProminence) continue

    // Anchor the marker at the middle of a plateau, or the point itself.
    // Spacing uses the target scale so the selection is animation-independent.
    const run = runs[r]!
    const idx = Math.round((run.startIdx + run.endIdx) / 2)
    const time = points[idx]!.time
    const { x } = toSvg(time, v, maxTime, maxAbsDiff)
    candidates.push({ x, time, diff: v, prominence, isLast: run.endIdx === points.length - 1 })
  }

  candidates.sort((a, b) => b.prominence - a.prominence)

  const chosen: typeof candidates = []
  for (const c of candidates) {
    if (chosen.length >= 6) break
    if (chosen.every((e) => Math.abs(e.x - c.x) >= minSpacing)) {
      chosen.push(c)
    }
  }
  return chosen
})

// Text is ~8px tall, ~22px wide at most. Keep labels inside the graph area.
const LABEL_H = 9
const LABEL_HALF_W = 14

/**
 * Extrema mapped to the animated coordinate space, with stable keys for
 * TransitionGroup fades. While a reveal tween runs, the endpoint extremum
 * rides the growing tip (its value counting up with the line) instead of
 * popping in at the final position.
 */
const extremaRender = computed(() => {
  if (!displaySeries.value) return []
  const { maxTime, maxAbsDiff } = animScale.value
  const pts = renderPoints.value
  return notableExtrema.value.map((ex) => {
    let x: number, y: number
    let value = ex.diff
    if (ex.isLast && reveal.value < 1 && pts.length > 0) {
      const tip = pts[pts.length - 1]!
      x = tip.x
      y = tip.y
      value = tip.diff
    } else {
      ;({ x, y } = toSvg(ex.time, ex.diff, maxTime, maxAbsDiff))
    }
    const isBlue = value >= 0
    // Preferred offset: 5px above peak for blue, 12px below valley for red
    const rawLabelY = isBlue ? y - 5 : y + LABEL_H
    const labelY = Math.max(GRAPH_TOP + LABEL_H + 2, Math.min(GRAPH_BOTTOM - 3, rawLabelY))
    // Clamp X so text never overflows left or right edge
    const labelX = Math.max(PADDING_X + LABEL_HALF_W, Math.min(WIDTH - PADDING_X - LABEL_HALF_W, x))
    // A persistent "edge" key keeps the running endpoint extremum from
    // re-fading on every new sample while the lead keeps growing.
    const key = ex.isLast ? 'edge' : `t${ex.time}`
    return { key, x, y, labelX, labelY, diff: value }
  })
})

/**
 * Vertical reference lines at every 5-minute mark. Positioned off the
 * animated scale so they slide along with the compressing graph; a newly
 * crossed 5-minute boundary fades its line in via TransitionGroup.
 */
const verticalLines = computed(() => {
  if (!displaySeries.value) return []
  const maxTime = animScale.value.maxTime
  const lines: Array<{ x: number; label: number }> = []
  for (let t = 300; t < maxTime; t += 300) {
    const x = PADDING_X + (t / maxTime) * (WIDTH - 2 * PADDING_X)
    lines.push({ x, label: Math.round(t / 60) })
  }
  return lines
})
</script>

<template>
  <SlideTransition>
    <div v-if="goldGraph" class="gold-graph-container">
      <div class="title-container">
        <div class="-translate-y-10 flex flex-row justify-between w-full items-center">
          <span class="title-text">Gold Graph</span>
          <span class="title-arrow ml-auto">&#8250;</span>
        </div>
      </div>

      <div class="team-info-container">
        <img
          v-if="blueTeam?.teamIconUrl"
          :src="client.getCacheUrl(blueTeam.teamIconUrl)"
          class="team-icon"
          style="border-left: 2px solid var(--blue-team-color)"
          alt="Blue team"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        <img
          v-if="redTeam?.teamIconUrl"
          :src="client.getCacheUrl(redTeam.teamIconUrl)"
          class="team-icon"
          style="border-left: 2px solid var(--red-team-color)"
          alt="Red team"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </div>

      <div class="graph-container">
        <div class="gold-graph">
          <svg
            v-if="displaySeries"
            :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
            preserveAspectRatio="none"
            class="chart"
          >
            <defs>
              <!-- Blue: solid at MID_Y, fades to transparent at GRAPH_TOP -->
              <linearGradient
                id="blueGrad"
                gradientUnits="userSpaceOnUse"
                x1="0"
                x2="0"
                :y1="MID_Y"
                :y2="GRAPH_TOP"
              >
                <stop offset="0%" stop-color="#2460c8" stop-opacity="0.8" />
                <stop offset="100%" stop-color="#2460c8" stop-opacity="0.1" />
              </linearGradient>
              <!-- Red: solid at MID_Y, fades to transparent at GRAPH_BOTTOM -->
              <linearGradient
                id="redGrad"
                gradientUnits="userSpaceOnUse"
                x1="0"
                x2="0"
                :y1="MID_Y"
                :y2="GRAPH_BOTTOM"
              >
                <stop offset="0%" stop-color="#c82424" stop-opacity="0.8" />
                <stop offset="100%" stop-color="#c82424" stop-opacity="0.1" />
              </linearGradient>
            </defs>

            <!-- Filled regions -->
            <path :d="fillPathBlue" fill="url(#blueGrad)" />
            <path :d="fillPathRed" fill="url(#redGrad)" />

            <!-- Zero / center line -->
            <line
              :x1="PADDING_X"
              :y1="MID_Y"
              :x2="WIDTH - PADDING_X"
              :y2="MID_Y"
              class="zero-line"
              stroke-width="1"
            />

            <!-- Vertical reference lines + time labels every 5 minutes -->
            <TransitionGroup tag="g" name="graph-fade">
              <g v-for="vl in verticalLines" :key="'vl-' + vl.label">
                <line
                  :x1="vl.x"
                  :y1="GRAPH_TOP"
                  :x2="vl.x"
                  :y2="GRAPH_BOTTOM"
                  stroke="rgba(255,255,255,0.12)"
                  stroke-width="1"
                />
                <text :x="vl.x" :y="HEIGHT - 2" text-anchor="middle" class="time-label">
                  {{ vl.label }}
                </text>
              </g>
            </TransitionGroup>

            <!-- Gold scale labels -->
            <text :x="PADDING_X + 4" :y="GRAPH_TOP + 11" class="pct-label">
              {{ scaleLabels.top }}
            </text>
            <text :x="PADDING_X + 4" :y="GRAPH_BOTTOM - 4" class="pct-label">
              {{ scaleLabels.bottom }}
            </text>

            <!-- Previous games: lines only, colored by the winner's current side. -->
            <g v-for="game in previousLines" :key="game.key" class="history-game">
              <path :d="game.d" fill="none" :stroke="game.color" class="history-line" />
              <circle :cx="game.end.x" :cy="game.end.y" r="2.5" :fill="game.color" />
              <text
                :x="game.labelX"
                :y="game.labelY"
                :text-anchor="game.textAnchor"
                :fill="game.color"
                class="history-label"
              >
                {{ game.label }}
              </text>
            </g>

            <!-- Data line: colored by leading team -->
            <path
              v-for="(seg, i) in coloredSegments"
              :key="i"
              :d="seg.d"
              fill="none"
              :stroke="seg.color === 'blue' ? 'rgba(100,160,255,0.95)' : 'rgba(255,100,100,0.95)'"
              stroke-width="1.5"
              stroke-linejoin="round"
            />

            <!-- Notable extrema labels -->
            <TransitionGroup tag="g" name="graph-fade">
              <g v-for="ex in extremaRender" :key="ex.key">
                <circle
                  :cx="ex.x"
                  :cy="ex.y"
                  r="2"
                  :fill="ex.diff >= 0 ? 'rgba(100,160,255,0.9)' : 'rgba(255,100,100,0.9)'"
                />
                <text
                  :x="ex.labelX"
                  :y="ex.labelY"
                  text-anchor="middle"
                  :class="ex.diff >= 0 ? 'extrema-label blue-label' : 'extrema-label red-label'"
                >
                  {{ formatGoldShort(ex.diff) }}
                </text>
              </g>
            </TransitionGroup>
          </svg>
        </div>
      </div>
    </div>
  </SlideTransition>
</template>

<style scoped>
.gold-graph-container {
  display: grid;
  grid-template-columns: 285px 176px 1fr;
  height: 260px;
  position: relative;
  z-index: 99;
  box-sizing: border-box;
}

.title-container {
  background-color: #1a1d24;
  /* project wash: accent bleeding in from the brand rail */
  background-image: linear-gradient(
    115deg,
    color-mix(in oklab, var(--broadcast-accent) 22%, transparent),
    transparent 55%
  );
  border-left: 4px solid var(--broadcast-accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 24px;
  padding-right: 24px;
  position: relative;
  overflow: hidden;
}

/* Brand sheen: same sweep as the power play cards, slower and softer */
.title-container::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 45%;
  background: linear-gradient(
    100deg,
    transparent,
    color-mix(in oklab, var(--broadcast-accent) 20%, transparent 55%),
    transparent
  );
  animation: title-sheen 15s ease-in-out infinite;
  pointer-events: none;
}

@keyframes title-sheen {
  0% {
    transform: translateX(-110%) skewX(-18deg);
  }

  25% {
    transform: translateX(330%) skewX(-18deg);
  }

  100% {
    transform: translateX(330%) skewX(-18deg);
  }
}

.title-text {
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
}

.title-arrow {
  color: var(--broadcast-accent);
  font-size: 48px;
  font-weight: 800;
}

.team-info-container {
  background-color: black;
  height: 260px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  padding: 8px 0;
}

.team-icon {
  width: auto;
  max-height: 40%;
  object-fit: contain;
  background-color: #12151a;
}

.graph-container {
  height: 260px;
  min-height: 0;
  z-index: 3;
  overflow: hidden;
  border: 10px solid rgba(0, 0, 0, 1);
  box-sizing: border-box;
}

.gold-graph {
  width: 100%;
  height: 100%;
  background-color: #12151a;
  color: #fff;
  font-weight: 800;
  user-select: none;
  overflow: hidden;
}

.chart {
  width: 100%;
  height: 100%;
  display: block;
}

.zero-line {
  stroke: color-mix(in oklab, var(--broadcast-accent) 60%, transparent);
}

.pct-label {
  fill: rgba(255, 255, 255, 0.45);
  font-size: 9px;
  font-weight: 800;
}

.history-line {
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.72;
}

.history-label {
  font-size: 8px;
  font-weight: 800;
  paint-order: stroke fill;
  stroke: #12151a;
  stroke-width: 3px;
  stroke-linejoin: round;
}

.extrema-label {
  font-size: 8px;
  font-weight: 700;
  paint-order: stroke fill;
  stroke: #12151a;
  stroke-width: 3px;
  stroke-linejoin: round;
}

.extrema-label.blue-label {
  fill: rgba(120, 175, 255, 1);
}

.extrema-label.red-label {
  fill: rgba(255, 120, 120, 1);
}

.time-label {
  fill: rgba(255, 255, 255, 1);
  font-size: 12px;
  font-weight: 800;
}

/* Graceful appear/disappear for extrema labels and gridlines */
.graph-fade-enter-active {
  transition: opacity 0.4s ease 0.15s;
}

.graph-fade-leave-active {
  transition: opacity 0.25s ease;
}

.graph-fade-enter-from,
.graph-fade-leave-to {
  opacity: 0;
}
</style>
