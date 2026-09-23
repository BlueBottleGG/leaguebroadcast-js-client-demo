import assert from 'node:assert/strict'
import { damagePath, gameClock, timelineX } from './teamfightTimelineData.ts'

assert.equal(gameClock(1458.9), '24:18')

assert.equal(timelineX(10, 10, 20), 16)
assert.equal(timelineX(15, 10, 20), 240)
assert.equal(timelineX(21, 10, 20), 464)
assert.equal(timelineX(10, 10, 10), 16)
assert.equal(
  damagePath(
    [
      { gameTime: 10, teamCumulativeDamage: [0, 0] },
      { gameTime: 15, teamCumulativeDamage: [50, 20] },
      { gameTime: 20, teamCumulativeDamage: [100, 40] },
    ],
    0,
    10,
    20,
    100,
  ),
  'M 16.0 100.0 L 240.0 56.0 L 464.0 12.0',
)
