import type {
  goldEfficiencyEntry,
  ingameScoreboardBottomData,
  ingameScoreboardBottomPlayerData,
} from '@bluebottle_gg/league-broadcast-client'

type PlayerIdentity = Pick<ingameScoreboardBottomPlayerData, 'name' | 'displayName' | 'champion'>

export interface GoldEfficiencyPlayer extends PlayerIdentity {
  ratio: number | null
}

export function hasGoldEfficiency(players: goldEfficiencyEntry[] | undefined): boolean {
  return !!players?.some((player) => player.team === 1 || player.team === 2)
}

function ratio(player?: goldEfficiencyEntry): number | null {
  // The backend calls this goldSpent, but supplies cumulative gold earned.
  if (!player || !Number.isFinite(player.goldSpent) || player.goldSpent <= 0) return null
  return Number.isFinite(player.efficiency) && player.efficiency >= 0 ? player.efficiency : null
}

export function efficiencyEdge(left: number | null | undefined, right: number | null | undefined) {
  if (left == null || right == null) return 'unknown'
  if (Math.abs(left - right) <= Math.max(left, right) * 0.1) return 'even'
  return left > right ? 'left' : 'right'
}

export function buildGoldEfficiencyRows(
  players: goldEfficiencyEntry[] = [],
  scoreboard?: ingameScoreboardBottomData,
) {
  const teams = [1, 2].map((team) => players.filter((player) => player.team === team))
  const rosters = [0, 1].map((side) => scoreboard?.teams[side]?.players ?? [])
  // Production's "role" is a champion identifier. Only exact Riot IDs in the
  // ordered scoreboard roster establish lanes; display names are not unique.
  const paired = rosters.every(
    (roster, side) =>
      roster.length === 5 &&
      teams[side]!.every((player) => roster.some((member) => member.name === player.name)),
  )
  const columns: (GoldEfficiencyPlayer | undefined)[][] = teams.map((team, side) => {
    if (paired) {
      return rosters[side]!.map((member) => {
        const entry = team.find((player) => player.name === member.name)
        return {
          name: member.name,
          displayName: entry?.displayName || member.displayName,
          champion: entry?.champion ?? member.champion,
          ratio: ratio(entry),
        }
      })
    }
    // No trustworthy lane order: compare ranks within each team, explicitly
    // labeled as ranks. Missing metrics sort last instead of becoming zeros.
    return [...team]
      .sort((a, b) => (ratio(b) ?? -1) - (ratio(a) ?? -1) || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((entry) => ({ ...entry, ratio: ratio(entry) }))
  })
  const scale = Math.max(
    2.5,
    ...columns.flatMap((column) => column.map((player) => player?.ratio ?? 0)),
  )
  const labels = ['TOP', 'JGL', 'MID', 'BOT', 'SUP']
  return {
    paired,
    scale,
    rows: labels.map((lane, index) => {
      const left = columns[0]?.[index]
      const right = columns[1]?.[index]
      return {
        label: paired ? lane : String(index + 1),
        players: [left, right],
        edge: paired ? efficiencyEdge(left?.ratio, right?.ratio) : null,
      }
    }),
  }
}
