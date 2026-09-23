<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  formatDamage,
  PHYS_COLOR,
  MAGIC_COLOR,
  TRUE_COLOR,
} from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import {
  buildIncomingDamage,
  buildOutgoingDamage,
  summarizeDamageSpells,
  type DamageSidebarModel,
} from './damageSidebarData'

const props = withDefaults(
  defineProps<{
    direction?: 'auto' | 'incoming' | 'outgoing'
    suppressed?: boolean
    footerLogo?: string
    footerName?: string
    footerCaption?: string
    sheen?: boolean
  }>(),
  { direction: 'auto' },
)
const emit = defineEmits<{ occupancy: [occupied: boolean] }>()
const client = useClient()
const incoming = useIngameSelector((state) => state.gameData.damageRecap)
const outgoing = useIngameSelector((state) => state.gameData.damageSplit)
const selected = computed(() => {
  if (props.suppressed) return null
  if (props.direction === 'incoming') return buildIncomingDamage(incoming.value)
  if (props.direction === 'outgoing') return buildOutgoingDamage(outgoing.value)
  return buildIncomingDamage(incoming.value) ?? buildOutgoingDamage(outgoing.value)
})
// Preserve the last frame during the exit so clearing the feed does not blank it.
const model = shallowRef<DamageSidebarModel | null>(null)
const visible = computed(() => !!selected.value)
watch(
  selected,
  (next) => {
    if (next) {
      model.value = next
      emit('occupancy', true)
    }
  },
  { immediate: true },
)

const page = ref(0)
const failedSpellIcons = ref(new Set<string>())
const pageCount = computed(() => Math.max(1, Math.ceil((model.value?.entries.length ?? 0) / 3)))
const entries = computed(() =>
  (model.value?.entries.slice(page.value * 3, page.value * 3 + 3) ?? []).map((entry) => ({
    ...entry,
    ...summarizeDamageSpells(entry.spells, entry.total, failedSpellIcons.value),
  })),
)
let pageTimer: ReturnType<typeof setInterval> | undefined
watch(
  () => selected.value?.key,
  () => {
    clearInterval(pageTimer)
    if (visible.value) {
      failedSpellIcons.value.clear()
      page.value = 0
      pageTimer = setInterval(() => (page.value = (page.value + 1) % pageCount.value), 7000)
    }
  },
  { immediate: true },
)
watch(pageCount, (count) => (page.value = Math.min(page.value, count - 1)))
onUnmounted(() => clearInterval(pageTimer))
function afterLeave() {
  if (!visible.value) {
    model.value = null
    emit('occupancy', false)
  }
}

const types = [
  { name: 'Physical', color: PHYS_COLOR },
  { name: 'Magic', color: MAGIC_COLOR },
  { name: 'True', color: TRUE_COLOR },
]
function segments(values: DamageSidebarModel['types'], total: number) {
  let offset = 0
  return (values ?? []).map((value, index) => {
    const fraction = total > 0 ? Math.min(1 - offset, value / total) : 0
    const style = {
      background: types[index]!.color,
      transform: `translateX(${offset * 100}%) scaleX(${Math.max(0, fraction)})`,
    }
    offset += fraction
    return style
  })
}
const number = (value: number) =>
  value < 10000 ? Math.round(value).toLocaleString('en-US') : formatDamage(value)
const percent = (share: number) => `${Math.round(share * 100)}%`
const imageUrl = (path?: string) => (path ? client.getCacheUrl(path) : undefined)
function handleSpellImageError(event: Event, icon: string) {
  handleImageError(event)
  failedSpellIcons.value.add(icon)
}
const teamColor = (team?: number) =>
  team === 1
    ? 'var(--blue-team-color)'
    : team === 2
      ? 'var(--red-team-color)'
      : 'rgb(255 255 255 / .35)'
const typeLabel = (values: DamageSidebarModel['types']) =>
  values
    ? values.map((value, index) => `${types[index]!.name}: ${number(value)}`).join(', ')
    : 'Damage type breakdown unavailable'
</script>

<template>
  <Transition name="damage-sidebar" appear mode="out-in" @after-leave="afterLeave">
    <aside
      v-if="visible && model"
      :key="model.key"
      class="damage-sidebar"
      :class="{ 'has-sheen': sheen }"
      :aria-label="
        model.direction === 'incoming' ? 'Incoming damage recap' : 'Outgoing damage split'
      "
    >
      <div class="panel-body">
        <header class="panel-header">
          <span class="brand-marker" aria-hidden="true" />
          <div>
            <h2>{{ model.direction === 'incoming' ? 'Damage taken' : 'Damage dealt' }}</h2>
          </div>
        </header>

        <div class="subject">
          <span
            class="subject-portrait portrait"
            :style="{ '--team-color': teamColor(model.team) }"
          >
            <span class="portrait-fallback">{{ model.name.slice(0, 2) }}</span>
            <img
              v-if="model.portrait"
              :src="imageUrl(model.portrait)"
              alt=""
              @error="handleImageError"
              @load="handleImageLoad"
            />
          </span>
          <div class="subject-info">
            <strong class="subject-name" :title="model.name">{{ model.name }}</strong>
            <span class="champion-name">{{ model.championName }}</span>
            <strong class="subject-total">{{ number(model.total) }}</strong>
          </div>
        </div>

        <div class="overall">
          <div class="mix-reveal">
            <div
              class="mix overall-mix"
              role="img"
              :aria-label="typeLabel(model.types)"
              :title="typeLabel(model.types)"
            >
              <span
                v-for="(style, index) in segments(model.types, model.total)"
                :key="index"
                :style="style"
              />
            </div>
          </div>
          <div class="legend" aria-hidden="true">
            <span v-for="type in types" :key="type.name"
              ><i :style="{ background: type.color }" />{{ type.name }}</span
            >
          </div>
        </div>

        <div class="entries-window">
          <Transition name="damage-page" mode="out-in">
            <ol :key="model.key + ':' + page" class="entries">
              <li
                v-for="(entry, index) in entries"
                :key="entry.key"
                class="entry"
                :style="{ '--row-index': index }"
              >
                <div class="entry-header">
                  <span
                    class="portrait entry-portrait"
                    :style="{ '--team-color': teamColor(entry.team) }"
                  >
                    <span class="portrait-fallback">{{ entry.name.slice(0, 2) }}</span>
                    <img
                      v-if="entry.portrait"
                      :src="imageUrl(entry.portrait)"
                      alt=""
                      @error="handleImageError"
                      @load="handleImageLoad"
                    />
                  </span>
                  <strong class="entry-name" :title="entry.name">{{ entry.name }}</strong>
                  <div class="entry-value">
                    <strong>{{ number(entry.total) }}</strong
                    ><span>{{ percent(entry.share) }}</span>
                  </div>
                </div>
                <div class="mix-reveal">
                  <div
                    class="mix"
                    role="img"
                    :aria-label="typeLabel(entry.types)"
                    :title="typeLabel(entry.types)"
                  >
                    <span
                      v-for="(style, typeIndex) in segments(entry.types, entry.total)"
                      :key="typeIndex"
                      :style="style"
                    />
                  </div>
                </div>
                <div v-if="entry.spells.length" class="spells">
                  <div
                    v-for="(spell, spellIndex) in entry.spells"
                    :key="spell.key"
                    class="spell"
                    :style="{ '--spell-index': spellIndex }"
                    :title="spell.name + ': ' + number(spell.damage)"
                  >
                    <span
                      v-if="spell.icon"
                      class="spell-icon"
                      :style="{
                        borderColor: spell.type == null ? undefined : types[spell.type]?.color,
                      }"
                    >
                      <img
                        :src="imageUrl(spell.icon)"
                        :alt="spell.name"
                        @error="handleSpellImageError($event, spell.icon)"
                        @load="handleImageLoad"
                      />
                    </span>
                    <span v-else class="sr-only">{{ spell.name }}</span>
                    <strong
                      :style="{ color: spell.type == null ? undefined : types[spell.type]?.color }"
                    >
                      {{ number(spell.damage) }}
                    </strong>
                  </div>
                  <div v-if="entry.otherDamage > 0" class="other-damage">
                    <span>Other</span><strong>{{ number(entry.otherDamage) }}</strong>
                  </div>
                </div>
              </li>
            </ol>
          </Transition>
        </div>

        <div class="pagination" :aria-label="`Page ${page + 1} of ${pageCount}`">
          <template v-if="pageCount > 1">
            <span class="page-dots" aria-hidden="true"
              ><i v-for="index in pageCount" :key="index" :class="{ active: index === page + 1 }"
            /></span>
            <span>{{ page + 1 }} / {{ pageCount }}</span>
          </template>
        </div>
      </div>
      <footer v-if="footerLogo" class="panel-footer" :class="{ 'logo-only': !footerCaption }">
        <span v-if="footerCaption">{{ footerCaption }}</span>
        <img
          :src="footerLogo"
          :alt="footerName || 'Broadcast logo'"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
.damage-sidebar {
  --accent: var(--brand-magenta, var(--broadcast-accent));
  width: 286px;
  height: 620px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: white;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  background: var(--surface-strong);
  border: var(--brand-border-width) solid var(--border-color);
  isolation: isolate;
  pointer-events: none;
}
.panel-body {
  position: relative;
  display: grid;
  grid-template-rows: 26px 84px 32px minmax(0, 1fr) 18px;
  gap: 10px;
  flex: 1;
  min-height: 0;
  padding: 16px 18px 10px;
  overflow: hidden;
}
.panel-body > * {
  position: relative;
  z-index: 1;
}
.has-sheen .panel-body::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 42%;
  z-index: 2;
  background: linear-gradient(
    100deg,
    transparent,
    color-mix(in oklab, var(--accent) 18%, transparent),
    transparent
  );
  transform: translateX(-125%) skewX(-18deg);
  animation: damage-sheen 16s ease-in-out infinite;
  pointer-events: none;
}
.panel-header {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.brand-marker {
  flex: 0 0 5px;
  height: 24px;
  margin-top: 1px;
  background: var(--accent);
}
h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  line-height: 26px;
  text-transform: uppercase;
  white-space: nowrap;
}
.subject {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  animation: detail-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) 90ms both;
}
.portrait {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--surface-soft);
  border: 1px solid var(--team-color);
  border-radius: var(--radius-sm);
}
.portrait img,
.spell-icon img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.portrait-fallback {
  color: rgb(255 255 255 / 0.7);
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
}
.subject-portrait {
  width: 64px;
  height: 64px;
}
.subject-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.subject-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  line-height: 21px;
  text-transform: uppercase;
}
.champion-name {
  min-height: 13px;
  color: rgb(255 255 255 / 0.8);
  font-size: 12px;
  line-height: 13px;
  text-transform: uppercase;
}
.subject-total {
  font-size: 38px;
  line-height: 38px;
  font-weight: 900;
  white-space: nowrap;
}
.mix {
  position: relative;
  width: 100%;
  height: 5px;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: rgb(255 255 255 / 0.12);
}
.overall-mix {
  height: 8px;
}
.mix > span {
  position: absolute;
  inset: 0;
  transform-origin: left;
  transition: transform 650ms cubic-bezier(0.22, 1, 0.36, 1);
}
.mix-reveal {
  transform-origin: left;
  animation: bar-enter 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.overall .mix-reveal {
  animation-delay: 160ms;
}
.legend {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-top: 9px;
  font-size: 10px;
  line-height: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.legend i {
  width: 8px;
  height: 8px;
}
.entries-window {
  min-height: 0;
}
.entries {
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 9px;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.entry {
  display: grid;
  grid-template-rows: 32px 5px minmax(0, 1fr);
  gap: 5px;
  min-height: 0;
  padding: 8px 0 0;
  border-top: 1px solid rgb(255 255 255 / 0.2);
  animation: detail-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) calc(130ms + var(--row-index) * 65ms)
    both;
}
.entry .mix-reveal {
  animation-delay: calc(180ms + var(--row-index) * 65ms);
}
.entry-header {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.entry-portrait {
  width: 32px;
  height: 32px;
}
.entry-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 18px;
  text-transform: uppercase;
}
.entry-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.entry-value strong {
  font-size: 21px;
  line-height: 21px;
  font-weight: 800;
}
.entry-value > span {
  color: rgb(255 255 255 / 0.8);
  font-size: 11px;
  line-height: 11px;
}
.spells {
  display: flex;
  justify-content: flex-start;
  align-items: end;
  gap: 8px;
  padding-top: 1px;
}
.spell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 34px;
  animation: spell-enter 350ms cubic-bezier(0.22, 1, 0.36, 1)
    calc(240ms + var(--row-index) * 65ms + var(--spell-index) * 45ms) both;
}
.spell-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.3);
  border-radius: var(--radius-xs);
  background: var(--surface-soft);
}
.spell strong,
.other-damage strong {
  font-size: 15px;
  line-height: 17px;
  font-weight: 800;
  white-space: nowrap;
}
.other-damage {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  align-self: center;
  gap: 4px;
  padding-left: 6px;
  border-left: 1px solid rgb(255 255 255 / 0.2);
}
.other-damage > span {
  font-size: 10px;
  line-height: 12px;
  color: rgb(255 255 255 / 0.8);
  text-transform: uppercase;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 18px;
  font-size: 12px;
  line-height: 18px;
  color: rgb(255 255 255 / 0.85);
}
.page-dots {
  display: flex;
  align-items: center;
  gap: 5px;
}
.page-dots i {
  width: 5px;
  height: 3px;
  background: rgb(255 255 255 / 0.35);
  transition:
    transform 200ms ease,
    background-color 200ms ease;
}
.page-dots i.active {
  background: var(--accent);
  transform: scaleX(1.4);
}
.panel-footer {
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 6px 18px;
  background: var(--surface-soft);
  border-top: var(--brand-border-width) solid var(--border-color);
}
.panel-footer > span {
  color: rgb(255 255 255 / 0.85);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.panel-footer img {
  width: 92px;
  max-height: 28px;
  object-fit: contain;
}
.panel-footer.logo-only img {
  width: 184px;
  max-height: 28px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.damage-sidebar-enter-active {
  transition:
    transform 450ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 280ms ease;
}
.damage-sidebar-leave-active {
  transition:
    transform 420ms cubic-bezier(0.55, 0, 0.75, 0.06),
    opacity 220ms ease 160ms;
}
.damage-sidebar-enter-from,
.damage-sidebar-leave-to {
  transform: translateX(-110%);
  opacity: 0;
}
.damage-page-enter-active,
.damage-page-leave-active {
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}
.damage-page-enter-from {
  transform: translateY(8px);
  opacity: 0;
}
.damage-page-leave-to {
  transform: translateY(-6px);
  opacity: 0;
}
@keyframes detail-enter {
  from {
    opacity: 0;
    transform: translateX(-18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes spell-enter {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes bar-enter {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes damage-sheen {
  0% {
    transform: translateX(-125%) skewX(-18deg);
  }
  22%,
  100% {
    transform: translateX(340%) skewX(-18deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .damage-sidebar,
  .damage-sidebar *,
  .damage-sidebar::after,
  .damage-sidebar *::after {
    animation: none !important;
    transition: none !important;
  }
  .has-sheen .panel-body::after {
    display: none;
  }
  .damage-sidebar-enter-from,
  .damage-sidebar-leave-to,
  .damage-page-enter-from,
  .damage-page-leave-to {
    transform: none;
    opacity: 1;
  }
}
</style>
