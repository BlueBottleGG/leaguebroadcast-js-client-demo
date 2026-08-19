import type { singleGameGoldGraphData } from '@bluebottle_gg/league-broadcast-client'

export type GoldHistorySide = 'blue' | 'red'

export type GoldHistorySeries = {
  gameNumber: number
  points: Array<{ time: number; diff: number }>
  winnerName: string
  winnerSide: GoldHistorySide
}

function normalizeTeamName(name: string | undefined): string {
  return name?.trim().toLocaleLowerCase() ?? ''
}

function samples(game: singleGameGoldGraphData) {
  return Object.entries(game.goldAtTime)
    .map(([time, teams]) => ({ time: Number(time), teams }))
    .filter((sample) => Number.isFinite(sample.time))
    .sort((a, b) => a.time - b.time)
}

/** Maps historical sides onto the teams' sides in the current game. */
export function buildGoldHistorySeries(
  current: singleGameGoldGraphData,
  previousGames: singleGameGoldGraphData[] = [],
): GoldHistorySeries[] {
  const currentSides = Object.entries(current.teams).sort(([a], [b]) => Number(a) - Number(b))
  const currentBlueName = normalizeTeamName(currentSides[0]?.[1])
  const currentRedName = normalizeTeamName(currentSides[1]?.[1])
  if (!currentBlueName || !currentRedName) return []

  return previousGames.flatMap((game, index) => {
    const entries = samples(game)
    if (entries.length < 2 || game.winner === undefined) return []

    const historicalSides = Object.keys(entries[0]?.teams ?? {})
      .map(Number)
      .sort((a, b) => a - b)
    const blueSide = historicalSides.find(
      (side) => normalizeTeamName(game.teams[side]) === currentBlueName,
    )
    const redSide = historicalSides.find(
      (side) => normalizeTeamName(game.teams[side]) === currentRedName,
    )
    if (blueSide === undefined || redSide === undefined) return []

    const winnerSide =
      Number(game.winner) === blueSide
        ? 'blue'
        : Number(game.winner) === redSide
          ? 'red'
          : undefined
    const winnerName = game.teams[game.winner]
    if (!winnerSide || !winnerName) return []

    return [
      {
        gameNumber: index + 1,
        points: entries.map(({ time, teams }) => ({
          time,
          diff: (teams[blueSide] ?? 0) - (teams[redSide] ?? 0),
        })),
        winnerName,
        winnerSide,
      },
    ]
  })
}
