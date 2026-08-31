/**
 * Dev-only builder for scripted teamfight timeline data.
 * Used by the TeamfightRecap ?teamfightDemo= harness and teamfight-preview.html.
 * Deterministic (no randomness) so screenshots are reproducible.
 */
import {
  ResourceType,
  SpellSlotIndex,
  Team,
  type damageGraphEntry,
  type ingameAbilityInfo,
  type ingameDamageGraphData,
  type ingameTeamfightTimelineData,
  type teamfightKillEvent,
  type teamfightTimelinePlayer,
  type simpleChampionData,
} from '@bluebottle_gg/league-broadcast-client'

export interface DemoFighter {
  champion: simpleChampionData
  team: Team
}

type DemoTeamfightPlayer = teamfightTimelinePlayer & {
  damageByType: { [key: string]: number }
}

function buildDamageByType(total: number, index: number): { [key: string]: number } {
  // Deterministic per-player split so every preview bar has a distinct mix.
  const physFrac = (((index * 37) % 70) + 15) / 100
  const magicFrac = Math.min(1 - physFrac, (((index * 53) % 60) + 10) / 100)
  const trueFrac = Math.max(0, 1 - physFrac - magicFrac)
  return {
    Physical: Math.round(total * physFrac),
    Magic: Math.round(total * magicFrac),
    True: Math.round(total * trueFrac),
  }
}

export function buildDemoTimeline(
  champs: DemoFighter[],
  killCount: number,
): ingameTeamfightTimelineData {
  const startTime = 1262 // 21:02
  const durationSecs = 38
  const endTime = startTime + durationSecs

  const players: DemoTeamfightPlayer[] = champs.slice(0, 10).map(({ champion, team }, i) => {
    // Deterministic spread from ~3k to ~14k so bars have visible ordering.
    const totalDamage = 3000 + ((i * 2654435761) % 11000)
    return {
      champion,
      name: `${champion.name}#demo`,
      displayName: `${champion.name} Player`,
      team,
      totalDamage,
      damageByType: buildDamageByType(totalDamage, i),
      died: false,
    }
  })

  const blue = players.filter((p) => p.team === Team.Order)
  const red = players.filter((p) => p.team === Team.Chaos)
  const blueTotal = blue.reduce((s, p) => s + p.totalDamage, 0)
  const redTotal = red.reduce((s, p) => s + p.totalDamage, 0)

  const sampleCount = durationSecs * 2 + 1
  const samples = Array.from({ length: sampleCount }, (_, i) => {
    const t = i / (sampleCount - 1)
    // smoothstep ramp with a little wobble so the two lines cross
    const ramp = t * t * (3 - 2 * t)
    const wobble = Math.sin(t * Math.PI * 3) * 0.06
    return {
      gameTime: startTime + t * durationSecs,
      damageValues: [],
      teamCumulativeDamage: [
        Math.max(0, blueTotal * (ramp + wobble * (1 - t))),
        Math.max(0, redTotal * (ramp - wobble * (1 - t))),
      ],
    }
  })

  const kills: teamfightKillEvent[] = Array.from({ length: killCount }, (_, i) => {
    const killerTeam = i % 3 === 2 ? Team.Chaos : Team.Order
    const killerPool = killerTeam === Team.Order ? blue : red
    const victimPool = killerTeam === Team.Order ? red : blue
    const killer = killerPool[i % killerPool.length]!
    const victim = victimPool[i % victimPool.length]!
    victim.died = true
    return {
      gameTime: startTime + 4 + (i * (durationSecs - 8)) / Math.max(killCount - 1, 1),
      killerName: killer.name,
      killerDisplayName: killer.displayName,
      victimName: victim.name,
      victimDisplayName: victim.displayName,
      killerChampion: killer.champion,
      victimChampion: victim.champion,
      killerTeam,
      assisterNames: [],
      assisterDisplayNames: [],
    }
  })

  return {
    startTime,
    endTime,
    samples,
    players,
    kills,
    totalDamagePerPlayer: players.map((p) => p.totalDamage),
    blueTotalDamage: blueTotal,
    redTotalDamage: redTotal,
    blueKills: kills.filter((k) => k.killerTeam === Team.Order).length,
    redKills: kills.filter((k) => k.killerTeam === Team.Chaos).length,
  }
}

const DDRAGON_SPELL = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell'

const SUMMONER_PAIRS: [string, string][] = [
  ['SummonerFlash', 'SummonerDot'],
  ['SummonerFlash', 'SummonerHaste'],
  ['SummonerHeal', 'SummonerFlash'],
  ['SummonerFlash', 'SummonerExhaust'],
  ['SummonerTeleport', 'SummonerFlash'],
]

function demoAbility(
  slot: SpellSlotIndex,
  iconAsset: string,
  overrides: Partial<ingameAbilityInfo> = {},
): ingameAbilityInfo {
  return {
    identifier: iconAsset,
    displayName: iconAsset,
    slot,
    totalCooldown: 300,
    readyAt: 0,
    level: 1,
    charges: 0,
    isToggled: false,
    assets: { spellName: iconAsset, iconAsset, iconName: iconAsset, nativeBinHash: 0 },
    ...overrides,
  }
}

// The backend now stamps damageGraphEntry (used by both damageGraph and
// teamfightDamageOverview) with buff-uptime flags. The published 1.7.0
// client declaration has not added these fields yet, so keep the
// compatibility extension local (mirrors TeamfightPlayerEntry.vue).
type DemoDamageGraphEntry = damageGraphEntry & {
  hasBaron?: boolean
  hasElder?: boolean
}

/**
 * Exercise all three buff-indicator states in the preview, with no randomness:
 * first blue player = baron only, first red player = elder only, second blue
 * player = both (conic swirl border). Keyed on a per-team slot counter rather
 * than the flat index so the coverage is stable regardless of how `champs`
 * interleaves teams.
 */
function demoBuffFlags(champs: DemoFighter[]): { hasBaron: boolean; hasElder: boolean }[] {
  const teamSlot = new Map<Team, number>()
  return champs.map(({ team }) => {
    const slot = teamSlot.get(team) ?? 0
    teamSlot.set(team, slot + 1)
    return {
      hasBaron: team === Team.Order && slot <= 1,
      hasElder: (team === Team.Chaos && slot === 0) || (team === Team.Order && slot === 1),
    }
  })
}

/** Fixture for the live CompactTeamfight overview (?view=compact). */
export function buildDemoTeamfightOverview(
  champs: DemoFighter[],
  gameTime = 1300,
): ingameDamageGraphData {
  const fighters = champs.slice(0, 10)
  const buffs = demoBuffFlags(fighters)
  const damageDealt: DemoDamageGraphEntry[] = fighters.map(({ champion, team }, i) => {
    const total = 3000 + ((i * 2654435761) % 11000)
    const [d, f] = SUMMONER_PAIRS[i % SUMMONER_PAIRS.length]!

    // Sparse array indexed by SpellSlotIndex, matching the live payload shape.
    const abilities: ingameAbilityInfo[] = []
    abilities[SpellSlotIndex.R] = demoAbility(SpellSlotIndex.R, champion.squareImg, {
      level: i === 4 ? 0 : 1,
      readyAt: i % 3 === 1 ? gameTime + 8 + i * 5 : 0,
      totalCooldown: 90,
    })
    abilities[SpellSlotIndex.D] = demoAbility(SpellSlotIndex.D, `${DDRAGON_SPELL}/${d}.png`, {
      readyAt: i % 4 === 2 ? gameTime + 40 : 0,
    })
    abilities[SpellSlotIndex.F] = demoAbility(SpellSlotIndex.F, `${DDRAGON_SPELL}/${f}.png`, {
      readyAt: i % 4 === 3 ? gameTime + 150 : 0,
    })

    const maxHealth = 1800 + i * 120
    return {
      champion,
      abilities,
      name: `${champion.name}#demo`,
      displayName: champion.name,
      team,
      damageByType: buildDamageByType(total, i),
      totalDamageDealt: total,
      respawnAt: i === 6 ? gameTime + 18 : undefined,
      level: 9 + i,
      health: {
        current: Math.round((maxHealth * (((i * 37) % 80) + 20)) / 100),
        max: maxHealth,
        shield: 0,
        physicalShield: 0,
        magicalShield: 0,
      },
      resource: { type: ResourceType.mana, current: 400 + i * 30, max: 1000 },
      experience: { previousLevel: 0, current: (i * 17) % 100, nextLevel: 100 },
      role: '',
      ...buffs[i]!,
    }
  })
  return { damageDealt }
}

export function buildDemoDamageGraph(champs: DemoFighter[]): ingameDamageGraphData {
  const fighters = champs.slice(0, 10)
  const buffs = demoBuffFlags(fighters)
  const damageDealt: DemoDamageGraphEntry[] = fighters.map(({ champion, team }, i) => {
    const total = 3000 + ((i * 2654435761) % 11000)
    return {
      champion,
      name: `${champion.name}#demo`,
      displayName: champion.name,
      team,
      damageByType: buildDamageByType(total, i),
      totalDamageDealt: total,
      role: '',
      ...buffs[i]!,
    }
  })
  return { damageDealt }
}
