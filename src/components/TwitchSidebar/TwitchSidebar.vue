<script setup lang="ts">
import { computed, onUnmounted, ref, shallowReactive, shallowRef, watch } from 'vue'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { buildTwitchModel, type TwitchKind, type TwitchModel } from './twitchData'

const props = withDefaults(defineProps<{ kind?: TwitchKind | 'auto'; suppressed?: boolean }>(), {
  kind: 'auto',
})
const emit = defineEmits<{ occupancy: [occupied: boolean] }>()
const client = useClient()
const flags = useIngameSelector((s) => ({
  prediction: !!s.gameData.showTwitchPrediction,
  poll: !!s.gameData.showTwitchPoll,
  chat: !!s.gameData.showTwitchChatVote,
}))
// One slot: predictions, then polls, then chat. Keep ownership through the result exit.
const priority: TwitchKind[] = ['prediction', 'poll', 'chat']
const enabled = computed(() =>
  priority.filter((kind) => flags.value[kind] && (props.kind === 'auto' || props.kind === kind)),
)
const snapshots = shallowReactive<Record<TwitchKind, TwitchModel | null>>({
  prediction: null,
  poll: null,
  chat: null,
})
const finished = new Map<TwitchKind, string>()
const requests = new Map<TwitchKind, symbol>()
const failures = new Map<TwitchKind, number>()
const observed = new Map<TwitchKind, string>()
const model = shallowRef<TwitchModel | null>(null)
const phase = ref<'live' | 'settle' | 'result' | 'exit'>('live')
const resultVisible = ref(false)
const page = ref(0)
const now = ref(Date.now())
let disposed = false
let phaseTimer: ReturnType<typeof setTimeout> | undefined
let nextPageAt = Date.now() + 5000
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function candidate() {
  if (props.suppressed) return null
  for (const kind of enabled.value) {
    const next = snapshots[kind]
    if (next && finished.get(kind) !== next.key) return next
  }
  return null
}

function leave() {
  if (!model.value || phase.value === 'exit') return
  clearTimeout(phaseTimer)
  phase.value = 'exit'
  phaseTimer = setTimeout(
    () => {
      model.value = null
      resultVisible.value = false
      phase.value = 'live'
      emit('occupancy', false)
      reconcile()
    },
    reducedMotion.matches ? 180 : resultVisible.value && winners.value.length ? 820 : 360,
  )
}

function showResult(next: TwitchModel) {
  clearTimeout(phaseTimer)
  model.value = next
  finished.set(next.kind, next.key)
  // First identify the winning row, then move that same row into the result position.
  phase.value = 'settle'
  const firstWinner = next.options.findIndex((row) => next.winnerIds.includes(row.id))
  if (firstWinner >= 0) page.value = Math.floor(firstWinner / rowsPerPage.value)
  phaseTimer = setTimeout(
    () => {
      resultVisible.value = true
      phase.value = 'result'
      page.value = 0
      nextPageAt = Date.now() + 3000
      // Keep every tied winner readable; reduced motion removes travel, not the reading time.
      phaseTimer = setTimeout(
        leave,
        Math.max(3600, Math.ceil(next.winnerIds.length / winnerRowsPerPage.value) * 3000 + 600),
      )
    },
    firstWinner >= 0 && !reducedMotion.matches ? 650 : 0,
  )
}

function reconcile() {
  if (disposed) return
  const current = model.value
  if (current && (props.suppressed || !enabled.value.includes(current.kind))) {
    leave()
    return
  }
  if (phase.value !== 'live') return
  const next = candidate()
  if (current && (!next || next.key !== current.key)) {
    leave()
    return
  }
  if (!next) return
  if (!current) {
    page.value = 0
    nextPageAt = Date.now() + 5000
    emit('occupancy', true)
  }
  model.value = next
  if (next.status === 'complete' || next.status === 'canceled') showResult(next)
}

async function refresh(kind: TwitchKind) {
  if (requests.has(kind)) return
  const request = Symbol(kind)
  requests.set(kind, request)
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const data = await Promise.race([
      client.api.getHttpClient().get<unknown>(`/twitch/${kind === 'chat' ? 'chatvote' : kind}`),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Twitch request timed out')), 5000)
      }),
    ])
    if (disposed || requests.get(kind) !== request || !enabled.value.includes(kind)) return
    let next = buildTwitchModel(kind, data)
    if (next?.status === 'active' || next?.status === 'locked') observed.set(kind, next.key)
    else if (next && observed.get(kind) !== next.key) next = null
    // Chat has no session id: observing a fresh active session rearms the result.
    if (next?.status === 'active' && snapshots[kind]?.status !== 'active') finished.delete(kind)
    snapshots[kind] = next
    failures.delete(kind)
  } catch {
    if (disposed || requests.get(kind) !== request) return
    const count = (failures.get(kind) ?? 0) + 1
    failures.set(kind, count)
    // A transport failure is never a final result. Retire stale content without a winner.
    if (count >= 2) snapshots[kind] = null
  } finally {
    clearTimeout(timeout)
    if (requests.get(kind) === request) requests.delete(kind)
    reconcile()
  }
}

watch(
  enabled,
  (kinds) => {
    for (const kind of priority) {
      if (!kinds.includes(kind)) {
        requests.delete(kind)
        snapshots[kind] = null
        failures.delete(kind)
        observed.delete(kind)
      } else void refresh(kind)
    }
    reconcile()
  },
  { immediate: true },
)
watch(() => props.suppressed, reconcile)
const pollTimer = setInterval(() => enabled.value.forEach((kind) => void refresh(kind)), 1000)
const clockTimer = setInterval(() => {
  now.value = Date.now()
  if ((phase.value === 'live' || phase.value === 'result') && now.value >= nextPageAt) {
    page.value = (page.value + 1) % pageCount.value
    nextPageAt = now.value + (resultVisible.value ? 3000 : 5000)
  }
}, 250)
onUnmounted(() => {
  disposed = true
  clearTimeout(phaseTimer)
  clearInterval(pollTimer)
  clearInterval(clockTimer)
  emit('occupancy', false)
})

const hasLongOptions = computed(
  () => model.value?.options.some((option) => option.label.length > 28) ?? false,
)
const rowsPerPage = computed(() =>
  hasLongOptions.value ? 3 : (model.value?.title.length ?? 0) > 32 ? 4 : 5,
)
const winnerRowsPerPage = computed(() => Math.min(4, rowsPerPage.value))
const pageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(
      resultVisible.value
        ? (model.value?.winnerIds.length ?? 0) / winnerRowsPerPage.value
        : (model.value?.options.length ?? 0) / rowsPerPage.value,
    ),
  ),
)
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count - 1)
})
const rows = computed(() =>
  resultVisible.value
    ? shownWinners.value
    : (model.value?.options.slice(
        page.value * rowsPerPage.value,
        (page.value + 1) * rowsPerPage.value,
      ) ?? []),
)
const winners = computed(
  () => model.value?.options.filter((row) => model.value?.winnerIds.includes(row.id)) ?? [],
)
const shownWinners = computed(() =>
  winners.value.slice(
    page.value * winnerRowsPerPage.value,
    (page.value + 1) * winnerRowsPerPage.value,
  ),
)
const panelHeight = computed(() => {
  // Budget for the full interaction, not the current page or result, so the frame stays still.
  const options = model.value?.options.length ?? 0
  const count = Math.min(options, rowsPerPage.value)
  const titleLength = model.value?.title.length ?? 0
  const titleHeight = titleLength > 55 ? 110 : titleLength > 32 ? 76 : titleLength ? 52 : 26
  const rowHeight = hasLongOptions.value ? 108 : count > 2 ? 76 : 72
  // 116px covers the border, header, footer, and body padding.
  return Math.min(
    620,
    Math.max(
      344,
      116 +
        titleHeight +
        16 +
        count * rowHeight +
        Math.max(0, count - 1) * (count > 2 ? 8 : 16) +
        (options > rowsPerPage.value ? 24 : 0),
    ),
  )
})
const heading = computed(() =>
  model.value?.kind === 'poll'
    ? 'Twitch poll'
    : model.value?.kind === 'chat'
      ? 'Chat vote'
      : 'Prediction',
)
const unit = computed(() => (model.value?.kind === 'prediction' ? 'points' : 'votes'))
const format = (value: number) => Math.round(value).toLocaleString('en-US')
const status = computed(() => {
  if (model.value?.status === 'canceled') return 'Closed'
  if (model.value?.status === 'complete') return 'Final'
  if (model.value?.status === 'locked') return 'Locked'
  if (model.value?.endsAt == null) return 'Live'
  const seconds = Math.max(0, Math.ceil((model.value.endsAt - now.value) / 1000))
  if (!seconds) return 'Closing'
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
</script>

<template>
  <aside
    v-if="model"
    :key="model.key"
    class="twitch-sidebar"
    :class="[
      'phase-' + phase,
      {
        'has-result': resultVisible,
        'has-winner': winners.length > 0,
        tied: winners.length > 1,
        'dense-options': model.options.length > 2,
      },
    ]"
    :style="{ height: panelHeight + 'px' }"
    :aria-label="heading + ': ' + (model.title || 'Audience vote')"
    :data-phase="phase"
    :data-kind="model.kind"
  >
    <div class="twitch-surface">
      <header class="twitch-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>{{ heading }}</h2>
        <span class="status">{{ status }}</span>
      </header>
      <div class="twitch-body">
        <h3
          v-if="model.title"
          class="question"
          :class="{ 'long-question': model.title.length > 55 }"
          :title="model.title"
        >
          {{ model.title }}
        </h3>
        <div v-else class="chat-caption">Audience vote</div>
        <div class="choices-window" :class="{ 'result-banner': resultVisible }">
          <div v-if="resultVisible" class="result-heading" role="status" aria-live="polite">
            <svg
              v-if="winners.length"
              class="trophy"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M14 7h20v11c0 9-5 14-10 14s-10-5-10-14V7Zm0 4H7v5c0 7 4 10 10 10m17-15h7v5c0 7-4 10-10 10M24 32v8m-9 3h18m-14-3h10"
              />
            </svg>
            <h3 class="result-label">{{ model.resultLabel }}</h3>
            <span class="sr-only">{{ shownWinners.map((winner) => winner.label).join(', ') }}</span>
          </div>
          <TransitionGroup name="twitch-choice" tag="ol" class="choices" appear>
            <li
              v-for="(row, index) in rows"
              :key="row.id"
              class="choice"
              :class="{ winner: model.winnerIds.includes(row.id) }"
              :style="{ '--row': index }"
              :data-option-id="row.id"
            >
              <div class="choice-summary">
                <strong
                  class="choice-label"
                  :class="{ 'long-name': row.label.length > 28 }"
                  :title="row.label"
                  >{{ row.label }}</strong
                >
                <strong class="choice-share">{{ Math.round(row.share) }}<span>%</span></strong>
              </div>
              <div class="choice-count">{{ format(row.value) }} {{ unit }}</div>
              <div class="bar-track" aria-hidden="true">
                <span :style="{ transform: 'scaleX(' + row.share / 100 + ')' }" />
              </div>
            </li>
          </TransitionGroup>
          <p v-if="resultVisible && !winners.length" class="neutral-result">
            {{
              model.status === 'canceled'
                ? 'Interaction closed'
                : model.total === 0
                  ? 'No votes were cast'
                  : 'No confirmed winner'
            }}
          </p>
        </div>
        <div v-if="pageCount > 1" class="pagination">{{ page + 1 }} / {{ pageCount }}</div>
      </div>
      <footer class="twitch-footer">
        <span
          >{{ format(model.total) }}
          {{ model.kind === 'prediction' ? 'channel points' : 'votes' }}</span
        >
      </footer>
    </div>
    <div class="speed-lines" aria-hidden="true">
      <i v-for="i in 6" :key="i" :style="{ '--line': i }" />
    </div>
  </aside>
</template>

<style scoped>
.twitch-sidebar {
  --accent: var(--brand-magenta, var(--broadcast-accent));
  position: relative;
  width: 286px;
  max-height: 620px;
  isolation: isolate;
  pointer-events: none;
  color: white;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
.twitch-surface {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  animation: twitch-enter 650ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.twitch-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 46px;
  padding: 0 14px;
  background: #1a1d24;
  border-bottom: var(--brand-border-width) solid var(--border-color);
}
.brand-marker {
  width: 4px;
  height: 21px;
  flex-shrink: 0;
  background: var(--accent);
}
.twitch-header h2 {
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}
.status {
  margin-left: auto;
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  white-space: nowrap;
  color: #d5dae3;
}
.twitch-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 12px;
}
.question {
  flex-shrink: 0;
  font-size: 23px;
  font-weight: 900;
  line-height: 1.1;
  text-transform: uppercase;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}
.question.long-question {
  font-size: 19px;
  line-height: 1.15;
  -webkit-line-clamp: 5;
}
.chat-caption {
  color: #d5dae3;
  font-size: 17px;
}
.choices-window {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 16px;
}
.choices {
  position: relative;
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 16px;
}
.dense-options .choices {
  gap: 8px;
}
.dense-options .choice-share {
  font-size: 29px;
}
.dense-options .bar-track {
  height: 10px;
}
.choice {
  min-height: 0;
  width: 100%;
  transition: opacity 300ms ease;
}
.choice-summary {
  display: flex;
  align-items: center;
  gap: 10px;
}
.choice-label {
  flex: 1;
  min-width: 0;
  font-size: 17px;
  line-height: 1.1;
  font-weight: 800;
  text-transform: uppercase;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.choice-label.long-name {
  font-size: 14px;
  line-height: 1.15;
  -webkit-line-clamp: 4;
}
.choice-share {
  font-size: 34px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}
.choice-share > span {
  font-size: 20px;
}
.choice-count {
  margin-top: 4px;
  text-align: right;
  font-size: 13px;
  line-height: 1;
  text-transform: uppercase;
  color: #c0c7d2;
}
.bar-track {
  height: 12px;
  margin-top: 8px;
  overflow: hidden;
  background: #282d36;
  border-radius: var(--radius-xs);
}
.bar-track > span {
  display: block;
  height: 100%;
  background: var(--accent);
  transform-origin: left;
  transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.pagination {
  padding-top: 12px;
  font-size: 12px;
  text-align: right;
  color: #c0c7d2;
}
.twitch-footer {
  flex: 0 0 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 18px;
  border-top: 1px solid #363b44;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: #d5dae3;
}
.phase-settle .choice:not(.winner) {
  opacity: 0.2;
}
.phase-settle .choice.winner .choice-label,
.phase-settle .choice.winner .choice-share {
  color: white;
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 80%, transparent);
}
.phase-settle .choice.winner .bar-track > span {
  background: white;
}
.has-result .choices-window {
  flex: 0 1 auto;
  margin: auto -18px;
  padding: 14px 18px 16px;
  border-block: 2px solid var(--accent);
}
.has-winner .result-banner {
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, #080910), #080910 80%);
}
.has-winner .result-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 35%,
    rgb(255 255 255 / 0.18) 50%,
    transparent 65%
  );
  transform: translateX(-110%);
  animation: winner-sweep 850ms ease-out 400ms both;
  pointer-events: none;
}
.result-heading {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  margin-bottom: 12px;
  padding: 4px 8px;
  background: var(--accent);
  border-radius: var(--radius-xs);
  animation: result-heading-in 450ms ease-out both;
}
.trophy {
  display: block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.result-label {
  font-size: 16px;
  line-height: 1.1;
  font-weight: 800;
  text-transform: uppercase;
}
.has-result .choices {
  flex: 0 1 auto;
  justify-content: center;
}
.has-result .choice:not(.winner) {
  opacity: 0;
}
.has-result .choice-label {
  font-weight: 900;
}
.has-result .choice-count {
  color: #d5dae3;
}
.has-result .bar-track > span {
  background: white;
}
.has-result .choices {
  gap: 12px;
}
.has-result.tied .choice-count,
.has-result.tied .bar-track {
  display: none;
}
.neutral-result {
  color: #d5dae3;
  font-size: 17px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.twitch-choice-move {
  transition: transform 650ms cubic-bezier(0.16, 1, 0.3, 1);
}
.twitch-choice-enter-active {
  transition:
    opacity 450ms ease,
    transform 550ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--row) * 55ms);
}
.twitch-choice-leave-active {
  position: absolute;
  transition:
    opacity 200ms ease,
    transform 260ms ease-in;
}
.twitch-choice-enter-from {
  opacity: 0;
  transform: translateX(-28px);
}
.twitch-choice-leave-to {
  opacity: 0;
  transform: translateX(60px);
}
.speed-lines {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.speed-lines i {
  position: absolute;
  top: calc(8% + var(--line) * 12%);
  left: 210px;
  width: calc(110px + var(--line) * 18px);
  height: 2px;
  background: linear-gradient(90deg, white, var(--accent) 24%, var(--accent) 65%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 55%, transparent);
  opacity: 0;
  transform-origin: left;
}
.speed-lines i:nth-child(3n) {
  height: 4px;
}
.phase-live .speed-lines i {
  animation: entry-speed 600ms ease-out calc(60ms + var(--line) * 35ms) both;
}
.phase-result.has-winner .speed-lines i {
  animation: result-speed 850ms cubic-bezier(0.16, 1, 0.3, 1) calc(var(--line) * 35ms) both;
}
.phase-exit .twitch-surface {
  animation: twitch-dismiss 340ms cubic-bezier(0.5, 0, 0.8, 0.2) both;
}
.phase-exit.has-result.has-winner .twitch-surface {
  animation: winner-exit 720ms cubic-bezier(0.55, 0, 0.85, 0.35) both;
}
.phase-exit.has-result.has-winner .twitch-header,
.phase-exit.has-result.has-winner .question,
.phase-exit.has-result.has-winner .chat-caption,
.phase-exit.has-result.has-winner .twitch-footer,
.phase-exit.has-result.has-winner .pagination {
  animation: content-out 160ms ease both;
}
.phase-exit.has-result.has-winner .speed-lines i {
  animation: exit-speed 680ms cubic-bezier(0.4, 0, 0.7, 0.4) calc(var(--line) * 18ms) both;
}
@keyframes twitch-enter {
  from {
    opacity: 0;
    transform: translateX(-100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes result-heading-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes winner-sweep {
  to {
    transform: translateX(110%);
  }
}
@keyframes entry-speed {
  0% {
    opacity: 0;
    transform: translateX(-240px) scaleX(0.35);
  }
  25% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translateX(120px) scaleX(1);
  }
}
@keyframes result-speed {
  0% {
    opacity: 0;
    transform: translateX(-90px) scaleX(0.2);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(160px) scaleX(1.25);
  }
}
@keyframes twitch-dismiss {
  to {
    opacity: 0;
    transform: translateX(-105%);
  }
}
@keyframes winner-exit {
  0%,
  18% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-115%);
  }
}
@keyframes exit-speed {
  0% {
    opacity: 0;
    transform: translateX(-20px) scaleX(0.4);
  }
  18% {
    opacity: 1;
    transform: translateX(30px) scaleX(1.5);
  }
  48% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(-530px) scaleX(0.8);
  }
}
@keyframes content-out {
  to {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .twitch-surface,
  .result-heading {
    animation: gentle-in 160ms ease both;
  }
  .phase-exit .twitch-surface,
  .phase-exit.has-result.has-winner .twitch-surface {
    animation: content-out 160ms ease both;
  }
  .speed-lines,
  .result-banner::after {
    display: none;
  }
  .choice,
  .bar-track > span,
  .twitch-choice-move,
  .twitch-choice-enter-active,
  .twitch-choice-leave-active {
    transition: opacity 160ms ease;
    transition-delay: 0ms;
  }
  .twitch-choice-enter-from,
  .twitch-choice-leave-to {
    transform: none;
  }
}
@keyframes gentle-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
