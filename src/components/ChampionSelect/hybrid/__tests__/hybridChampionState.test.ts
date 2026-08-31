import assert from 'node:assert/strict'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import { collectHybridChampionSlots } from '../hybridChampionState.ts'

const blue = {
  slots: [
    { champion: { alias: 'Ahri' }, isActive: true },
    { champion: { alias: 'Lux' }, isActive: false },
    { isActive: false },
  ],
} as championSelectTeam

assert.deepEqual(
  collectHybridChampionSlots(blue, undefined, { includeActive: true }).map((slot) => [
    slot.key,
    slot.alias,
    slot.isActive,
  ]),
  [
    ['blue-0', 'Ahri', true],
    ['blue-1', 'Lux', false],
  ],
)
assert.deepEqual(
  collectHybridChampionSlots(blue, undefined, { includeActive: false }).map((slot) => slot.alias),
  ['Lux'],
)

console.log('hybrid champion hover and lock collection passed')
