import type { teamfightTimelineSample } from '@bluebottle_gg/league-broadcast-client'

const LEFT = 16
const RIGHT = 464
const TOP = 12
const BOTTOM = 100

export function gameClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function timelineX(time: number, start: number, end: number): number {
  return LEFT + Math.max(0, Math.min(1, (time - start) / Math.max(end - start, 0.001))) * (RIGHT - LEFT)
}

export function damagePath(
  samples: teamfightTimelineSample[],
  teamIndex: 0 | 1,
  start: number,
  end: number,
  maximum: number,
): string {
  return samples
    .map((sample, index) => {
      const damage = Math.max(0, sample.teamCumulativeDamage[teamIndex] ?? 0)
      const y = BOTTOM - Math.min(damage / Math.max(maximum, 1), 1) * (BOTTOM - TOP)
      return `${index ? 'L' : 'M'} ${timelineX(sample.gameTime, start, end).toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}
