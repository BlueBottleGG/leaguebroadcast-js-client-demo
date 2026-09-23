import type {
  ingameKillParticipationData,
  ingameScoreboardBottomData,
  killParticipationPlayer,
} from '@bluebottle_gg/league-broadcast-client'

export interface ParticipationPlayer extends Omit<
  killParticipationPlayer,
  'team' | 'kills' | 'deaths' | 'assists'
> {
  team: 1 | 2
  kills: number | null
  deaths: number | null
  assists: number | null
  participation: number | null
}

export interface ParticipationTeam {
  team: 1 | 2
  players: ParticipationPlayer[]
  kills: number | null
  bestDuo?: { killer: ParticipationPlayer; assister: ParticipationPlayer; count: number }
}

const metric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
const named = (player: { name: string }) => typeof player.name === 'string' && !!player.name.trim()

export function hasKillParticipation(data?: ingameKillParticipationData): boolean {
  return !!data?.players?.some(
    (player) =>
      (player.team === 1 || player.team === 2) &&
      named(player) &&
      [player.kills, player.deaths, player.assists].some((value) => metric(value) !== null),
  )
}

export function buildKillParticipation(
  data?: ingameKillParticipationData,
  roster?: ingameScoreboardBottomData,
): { teams: ParticipationTeam[] } {
  const teams = ([1, 2] as const).map((team, side): ParticipationTeam => {
    const entries = (data?.players ?? []).filter((player) => player.team === team)
    const members = roster?.teams[side]?.players ?? []
    const rosterMatches =
      members.length === 5 &&
      members.every(named) &&
      new Set(members.map((member) => member.name)).size === 5 &&
      entries.every((entry) => members.some((member) => member.name === entry.name))
    const identities = rosterMatches ? members : entries.filter(named)
    const players = identities
      .filter((identity) => identities.filter((other) => other.name === identity.name).length === 1)
      .map((identity): ParticipationPlayer => {
        const matches = entries.filter((entry) => entry.name === identity.name)
        const entry = matches.length === 1 ? matches[0] : undefined
        const memberMatches = members.filter((member) => member.name === identity.name)
        const member = memberMatches.length === 1 ? memberMatches[0] : undefined
        return {
          name: identity.name,
          displayName: entry?.displayName || member?.displayName || identity.name,
          champion: entry?.champion ?? member?.champion,
          team,
          kills: metric(entry?.kills),
          deaths: metric(entry?.deaths),
          assists: metric(entry?.assists),
          participation: null,
        }
      })
    const complete =
      entries.length === 5 &&
      players.length === 5 &&
      players.every((player) => player.kills !== null)
    const killValues = complete
      ? players.map((player) => player.kills)
      : rosterMatches &&
          entries.length <= 5 &&
          new Set(entries.map((entry) => entry.name)).size === entries.length &&
          entries.every(
            (entry) =>
              metric(entry.kills) === null ||
              entry.kills === members.find((member) => member.name === entry.name)?.kills,
          )
        ? members.map((member) => metric(member.kills))
        : []
    const kills =
      killValues.length === 5 && killValues.every((value) => value !== null)
        ? metric(killValues.reduce<number>((sum, value) => sum + (value ?? 0), 0))
        : null
    for (const player of players) {
      if (kills !== null && player.kills !== null && player.assists !== null) {
        player.participation =
          kills === 0 ? 0 : Math.min(1, (player.kills + player.assists) / kills)
      }
    }
    players.sort(
      (left, right) =>
        (right.participation ?? -1) - (left.participation ?? -1) ||
        (rosterMatches
          ? members.findIndex((member) => member.name === left.name) -
            members.findIndex((member) => member.name === right.name)
          : left.name.localeCompare(right.name)),
    )
    return { team, players, kills }
  })

  const players = teams.flatMap((team) => team.players)
  for (const link of data?.links ?? []) {
    const count = metric(link.count)
    const killers = players.filter((player) => player.name === link.killerName)
    const assisters = players.filter((player) => player.name === link.assisterName)
    if (!count || killers.length !== 1 || assisters.length !== 1) continue
    if (
      [link.killerName, link.assisterName].some(
        (name) =>
          (data?.players ?? []).filter(
            (player) => (player.team === 1 || player.team === 2) && player.name === name,
          ).length !== 1,
      )
    )
      continue
    const killer = killers[0]!
    const assister = assisters[0]!
    if (killer === assister || killer.team !== assister.team) continue
    // Links are directional: never combine a reciprocal kill/assist connection.
    const team = teams[killer.team - 1]!
    if (!team.bestDuo || count > team.bestDuo.count) team.bestDuo = { killer, assister, count }
  }
  return { teams }
}
