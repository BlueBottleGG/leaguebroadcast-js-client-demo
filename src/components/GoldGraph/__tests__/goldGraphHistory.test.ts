import assert from 'node:assert/strict'
import type { singleGameGoldGraphData } from '@bluebottle_gg/league-broadcast-client'
import { buildGoldHistorySeries } from '../goldGraphHistory.ts'

function graph(
  teams: Record<number, string>,
  winner: number | undefined,
  goldAtTime: Record<number, Record<number, number>>,
): singleGameGoldGraphData {
  return { teams, winner, goldAtTime, events: [], teamfights: [] }
}

const current = graph({ 0: 'Alpha', 1: 'Beta' }, undefined, {
  0: { 0: 2500, 1: 2500 },
  60: { 0: 3000, 1: 2900 },
})

const history = buildGoldHistorySeries(current, [
  graph({ 0: 'Beta', 1: 'Alpha' }, 0, {
    0: { 0: 2500, 1: 2500 },
    1200: { 0: 42000, 1: 39000 },
  }),
  graph({ 0: 'Alpha', 1: 'Beta' }, 0, {
    0: { 0: 2500, 1: 2500 },
    1800: { 0: 55000, 1: 52000 },
  }),
])

assert.deepEqual(
  history.map(({ gameNumber, winnerName, winnerSide, points }) => ({
    gameNumber,
    winnerName,
    winnerSide,
    end: points.at(-1),
  })),
  [
    {
      gameNumber: 1,
      winnerName: 'Beta',
      winnerSide: 'red',
      end: { time: 1200, diff: -3000 },
    },
    {
      gameNumber: 2,
      winnerName: 'Alpha',
      winnerSide: 'blue',
      end: { time: 1800, diff: 3000 },
    },
  ],
)

console.log('gold graph history mapping passed')
