<script setup lang="ts">
import { computed } from 'vue'
import { dmgTypeColor, formatDamage } from '@bluebottle_gg/league-broadcast-client'
import { useClient } from '@/client'
import { useIngameSelector } from '@/composables/useIngame'
import { playerDisplayName } from '@/utils/playerDisplayName'
import { handleImageError, handleImageLoad } from '@/utils/imageUtils'
import Baron from '@/assets/baron/baron.png'
import { buildObjectiveRecap } from './objectiveRecapData'

defineProps<{ sponsorLogo?: string; sponsorName?: string }>()

const client = useClient()
const recap = useIngameSelector((state) => state.gameData.damageRecap)
const scoreboard = useIngameSelector((state) => state.gameData.scoreboard)
const model = computed(() => buildObjectiveRecap(recap.value))
const dragonIcons = import.meta.glob<string>('../../assets/dragon/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})
const objectiveName = computed(() => {
  const name = recap.value?.victimDisplayName || recap.value?.victimName || ''
  return name.toLowerCase() === 'baron' ? 'Baron Nashor' : name.split('#')[0]
})
const objectiveIcon = computed(() => {
  if (/baron/i.test(recap.value?.victimName ?? '')) return Baron
  return (
    dragonIcons['../../assets/dragon/' + recap.value?.dragonType?.toLowerCase() + '.png'] ||
    client.getCacheUrl('style/ingame/objectives/dragonpit/dragon_square.png')
  )
})
const events = computed(() =>
  (model.value?.events ?? []).map((event) => {
    const hit = event.hit
    const source = recap.value?.entries?.find((entry) => entry.sourceName === hit.sourceName)
    const portrait =
      recap.value?.sourceLookup?.[hit.sourceName]?.squareImg || source?.source?.squareImg
    const spell = hit.spellKey ? recap.value?.spellLookup?.[hit.spellKey] : undefined
    return {
      ...event,
      name: playerDisplayName(
        { displayName: hit.sourceDisplayName || source?.sourceDisplayName, name: hit.sourceName },
        'Unknown',
      ),
      portrait: portrait ? client.getCacheUrl(portrait) : undefined,
      spellIcon: spell?.iconAsset ? client.getCacheUrl(spell.iconAsset) : undefined,
      spellFallback: hit.isSmite ? 'SMITE' : /attack/i.test(hit.spellKey ?? '') ? 'AA' : '—',
      isEarlySmite:
        hit.isSmite &&
        model.value?.smite?.junglerName === hit.sourceName &&
        model.value.smite.smiteLandedTime === hit.gameTime &&
        model.value.smite.reactionTimeSeconds < 0,
      color: dmgTypeColor(hit.damageType),
      damageType: ['physical', 'magic', 'true'][hit.damageType] || 'unknown',
    }
  }),
)
const killerTeamName = computed(() => {
  const team = model.value?.killerTeam
  if (!team) return ''
  const source = scoreboard.value?.teams[team - 1]
  return source?.teamTag || source?.teamName || (team === 1 ? 'Blue' : 'Red')
})
const lastSmite = computed(() => [...events.value].reverse().find((event) => event.hit.isSmite))
const footerEvent = computed(() => lastSmite.value || events.value.at(-1))
const footerLabel = computed(() => {
  const smite = model.value?.smite
  if (smite?.wasKillingBlow) return 'Smite secured'
  if (smite) return smite.reactionTimeSeconds < 0 ? 'Smite too early' : 'Smite missed'
  return lastSmite.value ? 'Smite' : 'Killing blow'
})

function formatTime(seconds: number): string {
  const ms = Math.round(seconds * 1000)
  if (!ms) return '0 ms'
  const sign = ms < 0 ? '−' : ''
  return (
    sign + (Math.abs(ms) >= 1000 ? (Math.abs(ms) / 1000).toFixed(2) + ' s' : Math.abs(ms) + ' ms')
  )
}

function teamColor(team: number | null | undefined): string {
  return team === 1 ? 'var(--blue-team-color)' : team === 2 ? 'var(--red-team-color)' : '#cbd5e1'
}
</script>

<template>
  <Transition name="objective-recap">
    <section v-if="model" class="recap-panel" aria-label="Objective finishing sequence recap">
      <header class="panel-header">
        <span class="brand-marker" aria-hidden="true" />
        <h2>Objective recap</h2>
        <div class="objective-identity">
          <img :src="objectiveIcon" alt="" @error="handleImageError" @load="handleImageLoad" />
          <span :title="objectiveName">{{ objectiveName }}</span>
        </div>
        <div
          v-if="model.killerDamage !== null"
          class="team-damage"
          :style="{ '--team-color': teamColor(model.killerTeam) }"
        >
          <span class="metric-label">Killer team damage</span>
          <div class="metric-value">
            <span class="team-name" :title="killerTeamName">{{ killerTeamName }}</span>
            <strong>{{ formatDamage(model.killerDamage) }}</strong>
            <span v-if="model.killerShare !== null" class="damage-share">
              / {{ Math.round(model.killerShare * 100) }}%
            </span>
          </div>
        </div>
        <img
          v-if="sponsorLogo"
          class="sponsor-logo"
          :src="sponsorLogo"
          :alt="sponsorName || 'Sponsor'"
          @error="handleImageError"
          @load="handleImageLoad"
        />
      </header>

      <ol
        class="sequence"
        :style="{
          gridTemplateColumns: 'repeat(' + events.length + ', minmax(0, 1fr))',
          '--hit-count': events.length,
        }"
      >
        <li
          v-for="(event, index) in events"
          :key="event.key"
          class="hit"
          :class="{
            smite: event.hit.isSmite,
            separated: event.separated,
            killing: event.isKillingBlow,
          }"
          :style="{ '--team-color': teamColor(event.team), '--hit-index': index }"
          :aria-label="
            event.name +
            ', ' +
            Math.round(event.hit.damage) +
            ' ' +
            event.damageType +
            ' damage, ' +
            formatTime(event.secondsBeforeDeath) +
            (event.hit.isSmite ? ', smite' : '') +
            (event.isKillingBlow ? ', killing blow' : '') +
            (event.separated ? ', earlier smite shown separately' : '')
          "
        >
          <span class="event-time">{{ formatTime(event.secondsBeforeDeath) }}</span>
          <span class="time-marker" aria-hidden="true" />
          <div class="hit-icons" aria-hidden="true">
            <span class="portrait">
              <span class="portrait-fallback">{{ event.name.slice(0, 1) }}</span>
              <img
                v-if="event.portrait"
                :src="event.portrait"
                alt=""
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </span>
            <span class="spell">
              <span>{{ event.spellFallback }}</span>
              <img
                v-if="event.spellIcon"
                :src="event.spellIcon"
                alt=""
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </span>
          </div>
          <span class="player-name" :title="event.name">{{ event.name }}</span>
          <strong class="hit-damage" :style="{ color: event.color }">
            {{ Math.round(event.hit.damage).toLocaleString('en-US') }}
          </strong>
          <span class="event-note">
            {{
              event.isKillingBlow
                ? 'Killing blow'
                : event.isEarlySmite
                  ? 'Early smite'
                  : event.hit.isSmite
                    ? 'Smite'
                    : ''
            }}
          </span>
        </li>
      </ol>

      <footer class="recap-footer">
        <span v-if="footerEvent?.spellIcon" class="footer-icon">
          <img
            :src="footerEvent.spellIcon"
            alt=""
            @error="handleImageError"
            @load="handleImageLoad"
          />
        </span>
        <strong class="result">{{ footerLabel }}</strong>
        <span class="footer-player" :title="footerEvent?.name">{{ footerEvent?.name }}</span>
        <div v-if="model.smite" class="reaction">
          <strong>{{ formatTime(model.smite.reactionTimeSeconds) }}</strong>
          <span>Reaction time</span>
        </div>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.recap-panel {
  --smite-color: #ffc107;
  display: flex;
  flex-direction: column;
  height: 260px;
  overflow: hidden;
  pointer-events: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: white;
  background: #040508;
  border: var(--brand-border-width) solid var(--border-color);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  flex-shrink: 0;
  padding: 0 16px;
  background: #1a1d24;
  border-bottom: var(--brand-border-width) solid var(--border-color);
}
.brand-marker {
  flex-shrink: 0;
  width: 5px;
  height: 22px;
  background: var(--border-color);
}
h2 {
  margin: 0;
  flex-shrink: 0;
  font-size: 23px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}
.objective-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-left: 12px;
  border-left: 1px solid rgb(255 255 255 / 0.3);
  font-size: 18px;
  font-weight: 800;
  text-transform: uppercase;
}
.objective-identity img {
  flex-shrink: 0;
  width: 25px;
  height: 25px;
  object-fit: contain;
}
.objective-identity span,
.team-name,
.player-name,
.footer-player {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-damage {
  min-width: 0;
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 9px;
  border-left: 3px solid var(--team-color);
}
.metric-label {
  display: block;
  color: #bbc3cf;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.1;
  text-transform: uppercase;
}
.metric-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 19px;
  font-weight: 900;
  line-height: 1.1;
  white-space: nowrap;
}
.team-name {
  max-width: 126px;
  color: var(--team-color);
  text-transform: uppercase;
}
.damage-share {
  color: #d2d8e1;
}
.sponsor-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  margin-left: auto;
  object-fit: contain;
}
.team-damage + .sponsor-logo {
  margin-left: 4px;
}
.sequence {
  display: grid;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 12px;
  list-style: none;
}
.hit {
  position: relative;
  display: grid;
  grid-template-rows: 20px 16px 40px 22px 34px 18px;
  justify-items: center;
  min-width: 0;
  padding: 8px;
}
.hit::before {
  content: '';
  position: absolute;
  z-index: 1;
  top: 36px;
  left: -50%;
  width: 100%;
  border-top: 2px solid #667181;
}
.hit:first-child::before {
  display: none;
}
.hit.separated::before {
  border-top-style: dashed;
  border-top-color: var(--smite-color);
}
.hit + .hit::after {
  content: '';
  position: absolute;
  top: 58px;
  bottom: 12px;
  left: 0;
  border-left: 1px solid rgb(255 255 255 / 0.12);
}
.hit.smite {
  background: rgb(255 193 7 / 0.07);
  transition: background-color 260ms ease-out var(--enter-delay);
}
.event-time {
  color: #d2d8e1;
  font-size: 15px;
  font-weight: 800;
  line-height: 20px;
  white-space: nowrap;
}
.time-marker {
  z-index: 2;
  align-self: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--team-color);
}
.smite .time-marker {
  background: var(--smite-color);
}
.killing .time-marker {
  background: #f1f5f9;
}
.hit-icons {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-top: 3px;
}
.portrait,
.spell {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  background: #151a22;
  border-radius: var(--radius-xs);
}
.portrait {
  width: 36px;
  height: 36px;
  border: 2px solid var(--team-color);
}
.portrait-fallback {
  color: #bbc3cf;
  font-size: 18px;
}
.spell {
  width: 26px;
  height: 26px;
  border: 1px solid #667181;
  color: #d2d8e1;
  font-size: 8px;
  font-weight: 800;
}
.portrait img,
.spell img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.player-name {
  max-width: 100%;
  align-self: center;
  font-size: 16px;
  font-weight: 800;
  line-height: 20px;
  text-transform: uppercase;
}
.hit-damage {
  align-self: center;
  font-size: 31px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}
.event-note {
  align-self: center;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
  color: #d2d8e1;
}
.smite .event-note,
.smite .event-time {
  color: var(--smite-color);
}
.recap-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  height: 44px;
  padding: 0 16px;
  border-top: 1px solid #313944;
}
.footer-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}
.footer-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.result {
  flex-shrink: 0;
  font-size: 19px;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}
.footer-player {
  min-width: 0;
  max-width: 260px;
  padding-left: 12px;
  border-left: 1px solid #667181;
  color: #d2d8e1;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
}
.reaction {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-left: auto;
  white-space: nowrap;
}
.reaction strong {
  color: var(--smite-color);
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
}
.reaction span {
  color: #bbc3cf;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.panel-header {
  --enter-delay: 70ms;
  --exit-delay: 90ms;
}
.recap-footer {
  --enter-delay: 390ms;
  --exit-delay: 0ms;
}
.hit {
  --enter-delay: calc(110ms + var(--hit-index) * 45ms);
  --exit-delay: calc((var(--hit-count) - var(--hit-index) - 1) * 18ms);
}
/* Keep child transitions on their base styles so they can finish after the panel's slide. */
.panel-header > *,
.hit > *,
.recap-footer > * {
  transition:
    opacity 260ms ease-out var(--enter-delay),
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1) var(--enter-delay);
}
.hit::before {
  transform-origin: left center;
  transition:
    opacity 180ms ease-out var(--enter-delay),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1) var(--enter-delay);
}
.hit::after {
  transition: opacity 260ms ease-out var(--enter-delay);
}
.objective-recap-enter-active,
.objective-recap-leave-active {
  transition:
    transform 350ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 250ms ease;
}
.objective-recap-leave-active {
  transition-delay: 90ms;
}
.objective-recap-enter-from,
.objective-recap-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.objective-recap-enter-from .panel-header > *,
.objective-recap-enter-from .hit > *,
.objective-recap-enter-from .recap-footer > *,
.objective-recap-leave-to .panel-header > *,
.objective-recap-leave-to .hit > *,
.objective-recap-leave-to .recap-footer > * {
  opacity: 0;
  transform: translateY(10px);
}
.objective-recap-enter-from .time-marker,
.objective-recap-leave-to .time-marker {
  transform: scale(0.35);
}
.objective-recap-enter-from .hit::before,
.objective-recap-leave-to .hit::before {
  opacity: 0;
  transform: scaleX(0);
}
.objective-recap-enter-from .hit.smite,
.objective-recap-leave-to .hit.smite {
  background-color: transparent;
}
.objective-recap-enter-from .hit::after,
.objective-recap-leave-to .hit::after {
  opacity: 0;
}
.objective-recap-leave-active .hit.smite,
.objective-recap-leave-active .panel-header > *,
.objective-recap-leave-active .hit > *,
.objective-recap-leave-active .recap-footer > *,
.objective-recap-leave-active .hit::before,
.objective-recap-leave-active .hit::after {
  transition-duration: 160ms;
  transition-timing-function: ease-in;
  transition-delay: var(--exit-delay);
}
@media (prefers-reduced-motion: reduce) {
  .objective-recap-enter-active,
  .objective-recap-leave-active,
  .panel-header > *,
  .hit.smite,
  .hit > *,
  .recap-footer > *,
  .hit::before,
  .hit::after {
    transition: none;
  }
}
</style>
