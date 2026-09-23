import type {
  damageRecapTimelineEntry,
  ingameDamageRecapData,
} from '@bluebottle_gg/league-broadcast-client'

export interface ObjectiveRecapEvent {
  hit: damageRecapTimelineEntry
  key: string
  team: 1 | 2 | null
  isKillingBlow: boolean
  /** The incoming connector separates the prepended smite from the final five hits. */
  separated: boolean
  secondsBeforeDeath: number
}

const validDamage = (value: number) => Number.isFinite(value) && value >= 0

export function buildObjectiveRecap(
  recap?: ingameDamageRecapData | null,
  smiteLookbackSeconds = 5,
) {
  // These are the tracked objective identifiers and the backend's Baron mock name.
  if (
    !recap ||
    !['baron', 'baron nashor', 'dragon'].includes(recap.victimName?.toLowerCase()) ||
    ((recap.displayMode ?? 3) & 1) === 0 ||
    !Array.isArray(recap.timeline) ||
    recap.timeline.length === 0 ||
    recap.timeline.some(
      (hit) =>
        !hit ||
        !Number.isFinite(hit.gameTime) ||
        hit.gameTime < 0 ||
        typeof hit.sourceName !== 'string' ||
        !hit.sourceName.trim() ||
        !validDamage(hit.damage),
    ) ||
    !recap.timeline.some((hit) => hit.damage > 0)
  )
    return null

  // Preserve arrival order for same-tick hits: the final event is the killing blow.
  const timeline = recap.timeline
    .map((hit, index) => ({ hit, index }))
    .sort((a, b) => a.hit.gameTime - b.hit.gameTime || a.index - b.index)
  const final = timeline[timeline.length - 1]!
  const deathTime = final.hit.gameTime
  const selected = timeline.slice(-5)
  const lookback = Number.isFinite(smiteLookbackSeconds) ? Math.max(0, smiteLookbackSeconds) : 5
  const earlySmite = selected.some(({ hit }) => hit.isSmite)
    ? undefined
    : timeline
        .slice(0, -5)
        .reverse()
        .find(({ hit }) => hit.isSmite && deathTime - hit.gameTime <= lookback)
  if (earlySmite) selected.unshift(earlySmite)

  const entries = Array.isArray(recap.entries) ? recap.entries : []
  function sourceTeam(name: string): 1 | 2 | null {
    const matches = entries.filter((entry) => entry?.sourceName === name)
    const team = matches[0]?.team
    return (team === 1 || team === 2) && matches.every((entry) => entry.team === team) ? team : null
  }
  const events: ObjectiveRecapEvent[] = selected.map(({ hit, index }, position) => ({
    hit,
    key: `${hit.gameTime}:${index}`,
    team: sourceTeam(hit.sourceName),
    isKillingBlow: index === final.index,
    separated: !!earlySmite && position === 1,
    secondsBeforeDeath: hit.gameTime - deathTime,
  }))
  const killerTeam = sourceTeam(final.hit.sourceName)
  const killerEntries = entries.filter((entry) => killerTeam != null && entry?.team === killerTeam)
  const killerDamage =
    killerEntries.length > 0 && killerEntries.every((entry) => validDamage(entry.totalDamage))
      ? killerEntries.reduce((sum, entry) => sum + entry.totalDamage, 0)
      : null
  const killerShare =
    killerDamage != null &&
    Number.isFinite(killerDamage) &&
    Number.isFinite(recap.totalDamageReceived) &&
    recap.totalDamageReceived > 0 &&
    killerDamage <= recap.totalDamageReceived
      ? killerDamage / recap.totalDamageReceived
      : null

  const reaction = recap.smiteReaction
  const analyzedHit =
    reaction &&
    events
      .slice()
      .reverse()
      .find(
        ({ hit }) =>
          hit.isSmite &&
          hit.sourceName === reaction.junglerName &&
          hit.gameTime === reaction.smiteLandedTime,
      )
  const smite =
    reaction && analyzedHit && Number.isFinite(reaction.reactionTimeSeconds)
      ? { ...reaction, wasKillingBlow: analyzedHit.isKillingBlow }
      : null

  return {
    events,
    deathTime,
    killerTeam,
    killerDamage: Number.isFinite(killerDamage) ? killerDamage : null,
    killerShare,
    smite,
  }
}

export function hasObjectiveRecap(recap?: ingameDamageRecapData | null): boolean {
  return buildObjectiveRecap(recap) != null
}
