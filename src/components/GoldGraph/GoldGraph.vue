<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useIngameSelector } from "../../composables/useIngame";
import { useClient } from "@/client";
import { handleImageError, handleImageLoad } from "@/utils/imageUtils";
import SlideTransition from "@/transitions/SlideTransition.vue";

const client = useClient();
const scoreboard = useIngameSelector((s) => s.gameData.scoreboard);
const blueTeam = computed(() => scoreboard.value?.teams[0]);
const redTeam = computed(() => scoreboard.value?.teams[1]);

const goldGraph = useIngameSelector((s) => s.gameData.goldGraph);

/**
 * Parse the gold data into a per-team gold-difference series suitable for SVG rendering.
 * `goldAtTime` is keyed by game-time (seconds), each value is a map of teamId → gold.
 */
const series = computed(() => {
    const current = goldGraph.value?.current;
    if (!current?.goldAtTime) return null;

    const entries = Object.entries(current.goldAtTime)
        .map(([time, teams]) => ({ time: Number(time), teams }))
        .sort((a, b) => a.time - b.time);

    if (entries.length < 2) return null;

    // Team IDs from the data (usually 0 and 1)
    const teamIds = Object.keys(entries[0]?.teams ?? {}).map(Number);
    if (teamIds.length < 2) return null;

    const [t0, t1] = teamIds;
    const teamNames = current.teams ?? {};

    //prevent undefined t0 or t1 by defaulting to 0
    if (t0 === undefined || isNaN(t0) || t1 === undefined || isNaN(t1)) {
        console.warn("Invalid team IDs in gold graph data, defaulting to 0 and 1");
        return null;
    }

    // Compute gold difference: positive = team 0 ahead
    const points = entries.map((e) => ({
        time: e.time,
        diff: (e.teams[t0] ?? 0) - (e.teams[t1] ?? 0),
    }));

    const maxTime = points[points.length - 1]?.time ?? 0;
    const maxAbsDiff = Math.max(...points.map((p) => Math.abs(p.diff)), 1);

    return { points, maxTime, maxAbsDiff, teamNames, teamIds: [t0, t1] as const };
});

/**
 * Stable display series — only updated when the data meaningfully changes.
 * Prevents all downstream computeds from re-running every 0.5 s tick when
 * the server sends an identical snapshot.
 */
const displaySeries = ref<typeof series.value>(null);

/** Info for the "draw-in" animation when a single new point arrives. */
const newSegmentInfo = ref<{
    path: string;
    length: number;
    color: string;
} | null>(null);
let _segKey = 0;
const newSegmentAnimKey = ref(0);

watch(
    series,
    (next) => {
        if (!next) {
            displaySeries.value = null;
            newSegmentInfo.value = null;
            return;
        }
        const prev = displaySeries.value;
        const changed =
            !prev ||
            prev.points.length !== next.points.length ||
            prev.maxAbsDiff !== next.maxAbsDiff ||
            prev.points.at(-1)?.diff !== next.points.at(-1)?.diff;

        if (!changed) return;

        // Animate the new segment drawing in when exactly one point was added.
        if (prev && next.points.length === prev.points.length + 1) {
            const newPts = next.points.map((p) =>
                toSvg(p.time, p.diff, next.maxTime, next.maxAbsDiff)
            );
            const p1 = newPts[newPts.length - 2]!;
            const p2 = newPts[newPts.length - 1]!;
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const diff = next.points.at(-1)!.diff;
            newSegmentInfo.value = {
                path: `M${p1.x},${p1.y} L${p2.x},${p2.y}`,
                length: Math.max(len, 1),
                color: diff >= 0 ? "rgba(100,160,255,0.95)" : "rgba(255,100,100,0.95)",
            };
            newSegmentAnimKey.value = ++_segKey;
        } else {
            newSegmentInfo.value = null;
        }

        displaySeries.value = next;
    },
    { immediate: true }
);

// SVG viewBox dimensions — wide and short for a broadcast bar
const WIDTH = 700;
const HEIGHT = 175;
const PADDING_X = 5;
const GRAPH_TOP = 10;
const GRAPH_BOTTOM = 150;
const MID_Y = (GRAPH_TOP + GRAPH_BOTTOM) / 2;
const GRAPH_HEIGHT = GRAPH_BOTTOM - GRAPH_TOP;

/** Map a data point to SVG coordinates. */
function toSvg(
    time: number,
    diff: number,
    maxTime: number,
    maxAbsDiff: number
): { x: number; y: number } {
    const x = PADDING_X + (time / maxTime) * (WIDTH - 2 * PADDING_X);
    const y = MID_Y - (diff / maxAbsDiff) * (GRAPH_HEIGHT / 2);
    return { x, y };
}

/** Convert all data points to SVG coordinates. */
const svgPoints = computed(() => {
    if (!displaySeries.value) return [];
    const { points, maxTime, maxAbsDiff } = displaySeries.value;
    return points.map((p) => toSvg(p.time, p.diff, maxTime, maxAbsDiff));
});

/** Build an SVG path string from the gold-difference points. */
const pathD = computed(() => {
    const pts = svgPoints.value;
    if (pts.length === 0) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
});

/**
 * Build a fill path for one side of the zero line.
 * Inserts interpolated zero-crossing points so the fill edge
 * matches the actual data line exactly where it crosses MID_Y.
 */
function buildFillPath(pts: Array<{ x: number; y: number }>, side: "blue" | "red"): string {
    if (pts.length === 0) return "";
    const clamp = side === "blue"
        ? (y: number) => Math.min(y, MID_Y)
        : (y: number) => Math.max(y, MID_Y);

    const segments: string[] = [];

    for (let i = 0; i < pts.length; i++) {
        const curr = pts[i]!;

        // Check for a zero crossing between previous and current point
        if (i > 0) {
            const prev = pts[i - 1]!;
            if ((prev.y < MID_Y && curr.y > MID_Y) || (prev.y > MID_Y && curr.y < MID_Y)) {
                const t = (MID_Y - prev.y) / (curr.y - prev.y);
                const crossX = prev.x + t * (curr.x - prev.x);
                segments.push(`L${crossX},${MID_Y}`);
            }
        }

        const cy = clamp(curr.y);
        segments.push(`${i === 0 ? "M" : "L"}${curr.x},${cy}`);
    }

    // Close back along the zero line
    const lastX = pts[pts.length - 1]!.x;
    const firstX = pts[0]!.x;
    segments.push(`L${lastX},${MID_Y} L${firstX},${MID_Y} Z`);
    return segments.join(" ");
}

const fillPathBlue = computed(() => buildFillPath(svgPoints.value, "blue"));
const fillPathRed = computed(() => buildFillPath(svgPoints.value, "red"));

/**
 * Split the line into colored segments: blue when team 0 leads, red otherwise.
 * Inserts interpolated crossing points so each segment starts/ends exactly on MID_Y.
 */
const coloredSegments = computed(() => {
    const pts = svgPoints.value;
    const diffs = displaySeries.value?.points.map((p) => p.diff) ?? [];
    if (pts.length === 0) return [];

    const out: Array<{ d: string; color: string }> = [];
    let color = (diffs[0] ?? 0) >= 0 ? "blue" : "red";
    let seg: string[] = [`M${pts[0]!.x},${pts[0]!.y}`];

    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]!;
        const curr = pts[i]!;
        const pd = diffs[i - 1] ?? 0;
        const cd = diffs[i] ?? 0;

        if ((pd >= 0) !== (cd >= 0)) {
            const t = pd / (pd - cd);
            const cx = prev.x + t * (curr.x - prev.x);
            seg.push(`L${cx},${MID_Y}`);
            out.push({ d: seg.join(" "), color });
            color = cd >= 0 ? "blue" : "red";
            seg = [`M${cx},${MID_Y}`];
        }

        seg.push(`L${curr.x},${curr.y}`);
    }

    if (seg.length > 1) out.push({ d: seg.join(" "), color });
    return out;
});

function formatGoldShort(val: number): string {
    const abs = Math.abs(val);
    const sign = val > 0 ? "+" : "-";
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
    return `${sign}${Math.round(abs)}`;
}

/** Scale labels: max gold advantage at top (blue) and bottom (red). */
const scaleLabels = computed(() => {
    if (!displaySeries.value) return { top: "", bottom: "" };
    const max = displaySeries.value.maxAbsDiff;
    return {
        top: formatGoldShort(max),
        bottom: formatGoldShort(-max),
    };
});

/** Notable local extrema — significant, well-spaced peaks/valleys. */
const notableExtrema = computed(() => {
    if (!displaySeries.value) return [];
    const { points, maxTime, maxAbsDiff } = displaySeries.value;
    if (points.length < 3) return [];

    /**
     * Topographic prominence: how far a peak/valley stands out from the
     * surrounding terrain before being "absorbed" by a higher peak / deeper valley.
     *
     * For a peak at value v:
     *   Scan left until a point strictly exceeds v → key col = min value in that span
     *   Scan right similarly → key col = min value in that span
     *   Prominence = v − max(leftKeyCol, rightKeyCol)
     *
     * For a valley, the same logic inverted.
     * This correctly suppresses bumps on rising/falling slopes while surfacing
     * true reversals (including brief dips into the opposing team's lead).
     */
    function computeProminence(idx: number): number {
        const v = points[idx]!.diff;
        if (v === 0) return 0;
        if (v > 0) {
            let leftMin = v;
            for (let i = idx - 1; i >= 0; i--) {
                const d = points[i]!.diff;
                if (d > v) break;
                if (d < leftMin) leftMin = d;
            }
            let rightMin = v;
            for (let i = idx + 1; i < points.length; i++) {
                const d = points[i]!.diff;
                if (d > v) break;
                if (d < rightMin) rightMin = d;
            }
            return v - Math.max(leftMin, rightMin);
        } else {
            let leftMax = v;
            for (let i = idx - 1; i >= 0; i--) {
                const d = points[i]!.diff;
                if (d < v) break;
                if (d > leftMax) leftMax = d;
            }
            let rightMax = v;
            for (let i = idx + 1; i < points.length; i++) {
                const d = points[i]!.diff;
                if (d < v) break;
                if (d > rightMax) rightMax = d;
            }
            return Math.min(leftMax, rightMax) - v;
        }
    }

    const minProminence = Math.max(300, maxAbsDiff * 0.1);
    const minSpacing = (WIDTH - 2 * PADDING_X) * 0.1;

    const candidates: Array<{ x: number; y: number; diff: number; prominence: number }> = [];

    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1]!.diff;
        const curr = points[i]!.diff;
        const next = points[i + 1]!.diff;
        if (curr > prev && curr > next || curr < prev && curr < next) {
            const prominence = computeProminence(i);
            if (prominence >= minProminence) {
                const { x, y } = toSvg(points[i]!.time, curr, maxTime, maxAbsDiff);
                candidates.push({ x, y, diff: curr, prominence });
            }
        }
    }

    candidates.sort((a, b) => b.prominence - a.prominence);

    const chosen: typeof candidates = [];
    for (const c of candidates) {
        if (chosen.length >= 6) break;
        if (chosen.every((e) => Math.abs(e.x - c.x) >= minSpacing)) {
            chosen.push(c);
        }
    }

    // Text is ~8px tall, ~22px wide at most. Keep labels inside the graph area.
    const LABEL_H = 9;
    const LABEL_HALF_W = 14;
    const TOP_MARGIN = GRAPH_TOP + LABEL_H + 2;    // enough room above
    const BOT_MARGIN = GRAPH_BOTTOM - 3;            // don't enter the time-label strip

    return chosen.map((c) => {
        const isBlue = c.diff >= 0;
        // Preferred offset: 5px above peak for blue, 12px below valley for red
        const rawLabelY = isBlue ? c.y - 5 : c.y + LABEL_H;
        const labelY = Math.max(TOP_MARGIN, Math.min(BOT_MARGIN, rawLabelY));
        // Clamp X so text never overflows left or right edge
        const labelX = Math.max(PADDING_X + LABEL_HALF_W, Math.min(WIDTH - PADDING_X - LABEL_HALF_W, c.x));
        return { ...c, labelX, labelY };
    });
});

/** Vertical reference lines at every 5-minute mark. */
const verticalLines = computed(() => {
    if (!displaySeries.value) return [];
    const { maxTime } = displaySeries.value;
    const lines: Array<{ x: number; label: number }> = [];
    for (let t = 300; t < maxTime; t += 300) {
        const x = PADDING_X + (t / maxTime) * (WIDTH - 2 * PADDING_X);
        lines.push({ x, label: Math.round(t / 60) });
    }
    return lines;
});


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
                <img v-if="blueTeam?.teamIconUrl" :src="client.getCacheUrl(blueTeam.teamIconUrl)" class="team-icon"
                    style="border-left: 2px solid var(--blue-team-color);" alt="Blue team" @error="handleImageError"
                    @load="handleImageLoad" />
                <img v-if="redTeam?.teamIconUrl" :src="client.getCacheUrl(redTeam.teamIconUrl)" class="team-icon"
                    style="border-left: 2px solid var(--red-team-color);" alt="Red team" @error="handleImageError"
                    @load="handleImageLoad" />
            </div>

            <div class="graph-container">
                <div class="gold-graph">
                    <svg v-if="displaySeries" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none"
                        class="chart">
                        <defs>
                            <!-- Blue: solid at MID_Y, fades to transparent at GRAPH_TOP -->
                            <linearGradient id="blueGrad" gradientUnits="userSpaceOnUse" x1="0" x2="0" :y1="MID_Y"
                                :y2="GRAPH_TOP">
                                <stop offset="0%" stop-color="#2460c8" stop-opacity="0.8" />
                                <stop offset="100%" stop-color="#2460c8" stop-opacity="0.1" />
                            </linearGradient>
                            <!-- Red: solid at MID_Y, fades to transparent at GRAPH_BOTTOM -->
                            <linearGradient id="redGrad" gradientUnits="userSpaceOnUse" x1="0" x2="0" :y1="MID_Y"
                                :y2="GRAPH_BOTTOM">
                                <stop offset="0%" stop-color="#c82424" stop-opacity="0.8" />
                                <stop offset="100%" stop-color="#c82424" stop-opacity="0.1" />
                            </linearGradient>
                        </defs>

                        <!-- Filled regions -->
                        <path :d="fillPathBlue" fill="url(#blueGrad)" />
                        <path :d="fillPathRed" fill="url(#redGrad)" />

                        <!-- Zero / center line -->
                        <line :x1="PADDING_X" :y1="MID_Y" :x2="WIDTH - PADDING_X" :y2="MID_Y"
                            stroke="rgba(255,255,255,0.25)" stroke-width="1" />

                        <!-- Vertical reference lines every 5 minutes -->
                        <line v-for="vl in verticalLines" :key="vl.label" :x1="vl.x" :y1="GRAPH_TOP" :x2="vl.x"
                            :y2="GRAPH_BOTTOM" stroke="rgba(255,255,255,0.12)" stroke-width="1" />

                        <!-- Gold scale labels -->
                        <text :x="PADDING_X + 4" :y="GRAPH_TOP + 11" class="pct-label">{{ scaleLabels.top }}</text>
                        <text :x="PADDING_X + 4" :y="GRAPH_BOTTOM - 4" class="pct-label">{{ scaleLabels.bottom }}</text>

                        <!-- Data line: colored by leading team -->
                        <path v-for="(seg, i) in coloredSegments" :key="i" :d="seg.d" fill="none"
                            :stroke="seg.color === 'blue' ? 'rgba(100,160,255,0.95)' : 'rgba(255,100,100,0.95)'"
                            stroke-width="1.5" stroke-linejoin="round" />

                        <!-- Animated draw-in for the newest segment -->
                        <path v-if="newSegmentInfo" :key="newSegmentAnimKey" :d="newSegmentInfo.path" fill="none"
                            :stroke="newSegmentInfo.color" stroke-width="1.5" stroke-linejoin="round" :style="{
                                strokeDasharray: newSegmentInfo.length,
                                strokeDashoffset: newSegmentInfo.length,
                                animation: 'drawSegment 0.5s ease forwards',
                            }" />

                        <!-- Notable extrema labels -->
                        <g v-for="(ex, i) in notableExtrema" :key="'ex-' + i">
                            <circle :cx="ex.x" :cy="ex.y" r="2"
                                :fill="ex.diff >= 0 ? 'rgba(100,160,255,0.9)' : 'rgba(255,100,100,0.9)'" />
                            <text :x="ex.labelX" :y="ex.labelY" text-anchor="middle"
                                :class="ex.diff >= 0 ? 'extrema-label blue-label' : 'extrema-label red-label'">{{
                                    formatGoldShort(ex.diff) }}</text>
                        </g>

                        <!-- Time labels -->
                        <text v-for="vl in verticalLines" :key="'lbl-' + vl.label" :x="vl.x" :y="HEIGHT - 2"
                            text-anchor="middle" class="time-label">{{ vl.label }}</text>

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
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 24px;
    padding-right: 24px;
    position: relative;
}

.title-text {
    color: #ffffff;
    font-size: 24px;
    font-weight: 700;
    font-weight: 800;
}

.title-arrow {
    color: #ffffff;
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

.pct-label {
    fill: rgba(255, 255, 255, 0.45);
    font-size: 9px;
    font-weight: 800;
}

.extrema-label {
    font-size: 8px;
    font-weight: 800;
    font-weight: 600;
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

@keyframes drawSegment {
    to {
        stroke-dashoffset: 0;
    }
}
</style>
