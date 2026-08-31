import assert from 'node:assert/strict'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import {
  collectHybridChampionSlots,
  hybridChampionModelMedia,
  resolveHybridChampionModelStatus,
} from '../hybridChampionState.ts'

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

assert.equal(resolveHybridChampionModelStatus('Ahri', undefined), 'loading')
assert.equal(resolveHybridChampionModelStatus('Ahri', { alias: 'Lux', status: 'ready' }), 'loading')
assert.equal(
  resolveHybridChampionModelStatus('Ahri', { alias: 'Ahri', status: 'failed' }),
  'failed',
)
assert.equal(hybridChampionModelMedia('loading'), 'transparent')
assert.equal(hybridChampionModelMedia('ready'), 'model')
assert.equal(hybridChampionModelMedia('failed'), 'splash')

console.log('hybrid champion hover, lock, and model fallback state passed')
