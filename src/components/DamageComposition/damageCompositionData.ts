import type {
  damageCompositionPlayer,
  damageCompositionTeam,
  ingameDamageCompositionData,
  ingameScoreboardBottomData,
  ingameScoreboardBottomPlayerData,
} from '@bluebottle_gg/league-broadcast-client'

type PlayerIdentity = Pick<ingameScoreboardBottomPlayerData, 'name' | 'displayName' | 'champion'>
type DamageValues = [physical: number, magic: number, trueDamage: number]

export interface DamageCompositionPlayer extends PlayerIdentity {
  values: DamageValues | null
  total: number | null
}

function damageValues(
  entry?: Pick<
    damageCompositionPlayer | damageCompositionTeam,
    'physical' | 'magic' | 'trueDamage'
  >,
): DamageValues | null {
  if (!entry) return null
  const values: DamageValues = [entry.physical, entry.magic, entry.trueDamage]
  return values.every((value) => Number.isFinite(value) && value >= 0) ? values : null
}

function playerData(
  entry?: damageCompositionPlayer,
  identity?: PlayerIdentity,
): DamageCompositionPlayer | null {
  if (!entry && !identity) return null
  const values = damageValues(entry)
  return {
    name: identity?.name ?? entry!.name,
    displayName: entry?.displayName || identity?.displayName || identity?.name || entry!.name,
    champion: entry?.champion ?? identity?.champion,
    values,
    total: values?.reduce((sum, value) => sum + value, 0) ?? null,
  }
}

export function hasDamageComposition(data?: ingameDamageCompositionData): boolean {
  return !!data?.teams.some(
    (team) => (team.team === 1 || team.team === 2) && damageValues(team) !== null,
  )
}

export function buildDamageComposition(
  data?: ingameDamageCompositionData,
  scoreboard?: ingameScoreboardBottomData,
) {
  const feedTeams = [1, 2].map((team) => data?.teams.find((entry) => entry.team === team))
  const rosters = [0, 1].map((side) => scoreboard?.teams[side]?.players ?? [])
  const paired = rosters.every(
    (roster, side) =>
      roster.length === 5 &&
      roster.every((member) => member.name.trim().length > 0) &&
      new Set(roster.map((member) => member.name)).size === 5 &&
      (feedTeams[side]?.players ?? []).every((player) =>
        roster.some((member) => member.name === player.name),
      ),
  )

  const columns = feedTeams.map((team, side): Array<DamageCompositionPlayer | null> => {
    if (paired) {
      return rosters[side]!.map((member) =>
        playerData(
          team?.players.find((player) => player.name === member.name),
          member,
        ),
      )
    }

    const ranked = (team?.players ?? [])
      .map((player) => playerData(player)!)
      .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.name.localeCompare(b.name))
      .slice(0, 5)
    return Array.from({ length: 5 }, (_, index) => ranked[index] ?? null)
  })

  return {
    paired,
    maxDamage: Math.max(
      1,
      ...columns.flatMap((column) => column.map((player) => player?.total ?? 0)),
    ),
    teams: ([1, 2] as const).map((team, side) => {
      const values = damageValues(feedTeams[side])
      return {
        team,
        values,
        total: values?.reduce((sum, value) => sum + value, 0) ?? null,
        players: columns[side]!,
      }
    }),
  }
}
