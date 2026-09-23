import type { ingameObjectiveDpsData } from '@bluebottle_gg/league-broadcast-client'

export type ObjectiveDamageTypes = [physical: number, magic: number, trueDamage: number]
export type ObjectiveDamageData = ingameObjectiveDpsData & {
  blueDamageByType?: Record<string, number>
  redDamageByType?: Record<string, number>
}

export interface ObjectiveDamageTeam {
  team: 1 | 2
  damage: number
  share: number
  offset: number
  types: ObjectiveDamageTypes | null
}

export interface ObjectiveDamageSegment {
  team: 1 | 2
  type: 0 | 1 | 2 | null
  amount: number
  share: number
  offset: number
}

export interface ObjectiveDamageModel {
  key: string
  name: string
  total: number
  teams: ObjectiveDamageTeam[]
  segments: ObjectiveDamageSegment[]
}

const validDamage = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function damageType(key: string): 0 | 1 | 2 | undefined {
  const normalized = key.toLowerCase()
  return normalized === 'physical' || normalized === '0'
    ? 0
    : normalized === 'magic' || normalized === '1'
      ? 1
      : normalized === 'true' || normalized === '2'
        ? 2
        : undefined
}

function typesFor(map: Record<string, number> | undefined, total: number) {
  if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length) return null
  const values: ObjectiveDamageTypes = [0, 0, 0]
  for (const [key, amount] of Object.entries(map)) {
    const type = damageType(key)
    if (!validDamage(amount) || (type == null && amount > 0)) return null
    if (type != null) values[type] += amount
  }
  const sum = values[0] + values[1] + values[2]
  return Number.isFinite(sum) && Math.abs(sum - total) <= Math.max(0.01, total * 1e-6)
    ? values
    : null
}

export function revealedObjectiveShare(progress: number, offset: number, share: number) {
  if (progress <= offset) return 0
  if (progress >= offset + share) return share
  return progress - offset
}

export function buildObjectiveDamage(
  data?: ObjectiveDamageData | null,
): ObjectiveDamageModel | null {
  if (!data || !Array.isArray(data.samples) || !data.samples.length) return null
  const sample = data.samples.at(-1)
  if (!sample || !validDamage(sample.blueDamage) || !validDamage(sample.redDamage)) return null
  const total = sample.blueDamage + sample.redDamage
  if (!Number.isFinite(total) || total === 0) return null

  const blueTypes = typesFor(data.blueDamageByType, sample.blueDamage)
  const redTypes = typesFor(data.redDamageByType, sample.redDamage)
  const teams: ObjectiveDamageTeam[] = [
    {
      team: 1,
      damage: sample.blueDamage,
      share: sample.blueDamage / total,
      offset: 0,
      types: blueTypes,
    },
    {
      team: 2,
      damage: sample.redDamage,
      share: sample.redDamage / total,
      offset: sample.blueDamage / total,
      types: redTypes,
    },
  ]
  const segments = teams.flatMap<ObjectiveDamageSegment>((team) => {
    const amounts = (team.types ?? [team.damage])
      .map((amount, type) => ({ amount, type: team.types ? (type as 0 | 1 | 2) : null }))
      .filter(({ amount }) => amount > 0)
    const typeTotal = amounts.reduce((sum, segment) => sum + segment.amount, 0)
    let offset = team.offset
    return amounts.map(({ amount, type }) => {
      const share = team.types ? (amount / typeTotal) * team.share : team.share
      const segment = {
        team: team.team,
        type,
        amount,
        share,
        offset,
      }
      offset += segment.share
      return segment
    })
  })

  const objectiveName =
    typeof data.objectiveName === 'string' && data.objectiveName.trim()
      ? data.objectiveName.trim()
      : 'Objective'
  return {
    key: JSON.stringify([data.objectiveName, data.startTime, data.endTime]),
    name: /^baron(?: nashor)?$/i.test(objectiveName) ? 'Baron Nashor' : objectiveName,
    total,
    teams,
    segments,
  }
}
