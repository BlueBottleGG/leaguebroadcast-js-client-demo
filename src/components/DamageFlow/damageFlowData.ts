import type {
  damageFlowNode,
  ingameScoreboardBottomData,
} from '@bluebottle_gg/league-broadcast-client'
import { DamageFlowView, type DamageFlowData } from './damageFlowTypes.ts'

export interface DamageFlowPlayer extends damageFlowNode {
  dealt: number
  received: number
}

export type DamageFlowDamageTypes = [
  physical: number,
  magic: number,
  trueDamage: number,
  unknown: number,
]

export interface DamageFlowEdgeView {
  key: string
  source: DamageFlowPlayer
  target: DamageFlowPlayer
  value: number
  damageTypes: DamageFlowDamageTypes
}

export interface DamageFlowTarget {
  target: DamageFlowPlayer
  value: number | null
  share: number | null
  damageTypes: DamageFlowDamageTypes | null
}

export interface DamageFlowRecipient {
  node: DamageFlowPlayer
  value: number
  leadingSource: DamageFlowPlayer | null
  leadingValue: number
  leadingShare: number
  leadingDamageTypes: DamageFlowDamageTypes
  otherDamageTypes: DamageFlowDamageTypes
}

export interface DamageFlowOptions {
  spotlightName?: string
  sourceOrder?: string[]
  targetOrder?: string[]
  edgeOrder?: string[]
  receivedOrder?: string[]
}

const edgeKey = (source: string, target: string) => JSON.stringify([source, target])
const validDamage = (value: number) => Number.isFinite(value) && value >= 0
const emptyDamageTypes = (): DamageFlowDamageTypes => [0, 0, 0, 0]

function edgeDamageTypes(value: number, damageByType: unknown): DamageFlowDamageTypes {
  if (!damageByType || typeof damageByType !== 'object' || Array.isArray(damageByType))
    return [0, 0, 0, value]
  const result = emptyDamageTypes()
  for (const [rawType, amount] of Object.entries(damageByType)) {
    if (typeof amount !== 'number' || !validDamage(amount)) return [0, 0, 0, value]
    const type = rawType.trim().toLowerCase()
    const index: 0 | 1 | 2 | undefined =
      type === 'physical' || type === '0'
        ? 0
        : type === 'magic' || type === '1'
          ? 1
          : type === 'true' || type === '2'
            ? 2
            : undefined
    if (index != null) {
      result[index] += amount
      if (!Number.isFinite(result[index])) return [0, 0, 0, value]
    }
  }
  const typed = result[0] + result[1] + result[2]
  const tolerance = Math.max(0.01, value * 1e-9)
  if (!Number.isFinite(typed) || typed > value + tolerance) return [0, 0, 0, value]
  if (typed > value) {
    const scale = value / typed
    result[0] *= scale
    result[1] *= scale
    result[2] *= scale
  }
  result[3] = Math.max(0, value - result[0] - result[1] - result[2])
  return result
}

function addDamageTypes(
  left: DamageFlowDamageTypes,
  right: DamageFlowDamageTypes,
): DamageFlowDamageTypes {
  return left.map((value, index) => value + right[index]!) as DamageFlowDamageTypes
}

function uniqueNodes(data?: DamageFlowData) {
  const entries: unknown[] = Array.isArray(data?.nodes) ? data.nodes : []
  const candidates = entries.filter(
    (entry): entry is damageFlowNode =>
      !!entry &&
      typeof entry === 'object' &&
      'name' in entry &&
      typeof entry.name === 'string' &&
      entry.name.trim().length > 0,
  )
  const counts = new Map<string, number>()
  for (const node of candidates) counts.set(node.name, (counts.get(node.name) ?? 0) + 1)
  return new Map(
    candidates
      .filter((node) => (node.team === 1 || node.team === 2) && counts.get(node.name) === 1)
      .map((node) => [node.name, node]),
  )
}

function aggregateEdges(data: DamageFlowData | undefined, nodes: ReturnType<typeof uniqueNodes>) {
  const values = new Map<string, { value: number; damageTypes: DamageFlowDamageTypes }>()
  const invalid = new Set<string>()
  const entries: unknown[] = Array.isArray(data?.edges) ? data.edges : []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const edge = entry as Record<string, unknown>
    if (typeof edge.sourceName !== 'string' || typeof edge.targetName !== 'string') continue
    const source = nodes.get(edge.sourceName)
    const target = nodes.get(edge.targetName)
    if (!source || !target || source.team === target.team) continue
    const key = edgeKey(source.name, target.name)
    if (typeof edge.totalDamage !== 'number' || !validDamage(edge.totalDamage)) {
      invalid.add(key)
      values.delete(key)
      continue
    }
    if (invalid.has(key)) continue
    const previous = values.get(key)
    const value = (previous?.value ?? 0) + edge.totalDamage
    const damageTypes = addDamageTypes(
      previous?.damageTypes ?? emptyDamageTypes(),
      edgeDamageTypes(edge.totalDamage, edge.damageByType),
    )
    if (!Number.isFinite(value) || damageTypes.some((amount) => !Number.isFinite(amount))) {
      invalid.add(key)
      values.delete(key)
      continue
    }
    values.set(key, { value, damageTypes })
  }
  return { values, invalid }
}

function preferredIndex(order?: string[]) {
  return new Map(order?.map((name, index) => [name, index]))
}

function orderTeam(
  players: DamageFlowPlayer[],
  roster: string[],
  preferred?: string[],
): DamageFlowPlayer[] {
  const preferredRanks = preferredIndex(preferred)
  const rosterRanks = preferredIndex(roster)
  return [...players].sort((a, b) => {
    const aPreferred = preferredRanks.get(a.name)
    const bPreferred = preferredRanks.get(b.name)
    if (aPreferred != null || bPreferred != null)
      return (aPreferred ?? Number.MAX_SAFE_INTEGER) - (bPreferred ?? Number.MAX_SAFE_INTEGER)
    const aRoster = rosterRanks.get(a.name)
    const bRoster = rosterRanks.get(b.name)
    if (aRoster != null || bRoster != null)
      return (aRoster ?? Number.MAX_SAFE_INTEGER) - (bRoster ?? Number.MAX_SAFE_INTEGER)
    return a.name.localeCompare(b.name)
  })
}

function cachedRank<T>(
  entries: T[],
  order: string[] | undefined,
  key: (entry: T) => string,
  value: (entry: T) => number,
): T[] {
  const ranks = preferredIndex(order)
  return [...entries].sort((a, b) => {
    if (order?.length) {
      const aRank = ranks.get(key(a))
      const bRank = ranks.get(key(b))
      if (aRank != null || bRank != null)
        return (aRank ?? Number.MAX_SAFE_INTEGER) - (bRank ?? Number.MAX_SAFE_INTEGER)
    }
    return value(b) - value(a) || key(a).localeCompare(key(b))
  })
}

export function formatDamageFlowScope(data?: DamageFlowData): string {
  if (
    data?.startTime == null ||
    !Number.isFinite(data.startTime) ||
    !Number.isFinite(data.endTime) ||
    data.endTime <= data.startTime
  )
    return 'ALL GAME'
  const seconds = Math.round(data.endTime - data.startTime)
  if (seconds >= 60 && seconds % 60 === 0) return `LAST ${seconds / 60} MIN`
  if (seconds >= 60)
    return `LAST ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return `LAST ${seconds} SEC`
}

export function hasDamageFlow(data?: DamageFlowData): boolean {
  if (!Array.isArray(data?.nodes) || !Array.isArray(data.edges)) return false
  const nodes = uniqueNodes(data)
  if (![1, 2].every((team) => [...nodes.values()].some((node) => node.team === team))) return false
  if (data.edges.length === 0) return true
  return aggregateEdges(data, nodes).values.size > 0
}

export function buildDamageFlow(
  data?: DamageFlowData,
  roster?: ingameScoreboardBottomData,
  options: DamageFlowOptions = {},
) {
  const view =
    data?.view === DamageFlowView.PlayerSpotlight ||
    data?.view === DamageFlowView.DamageReceived ||
    data?.view === DamageFlowView.MatchupMatrix
      ? data.view
      : DamageFlowView.StrongestConnections
  const attackingTeam: 1 | 2 = data?.attackingTeam === 2 ? 2 : 1
  const defendingTeam: 1 | 2 = attackingTeam === 1 ? 2 : 1
  const nodes = uniqueNodes(data)
  const aggregated = aggregateEdges(data, nodes)
  const players = new Map<string, DamageFlowPlayer>(
    [...nodes].map(([name, node]) => [name, { ...node, dealt: 0, received: 0 }]),
  )
  const allEdges: DamageFlowEdgeView[] = []
  for (const [key, aggregate] of aggregated.values) {
    const [sourceName, targetName] = JSON.parse(key) as [string, string]
    const source = players.get(sourceName)!
    const target = players.get(targetName)!
    allEdges.push({ key, source, target, ...aggregate })
  }
  const directionEdges = allEdges.filter((edge) => edge.source.team === attackingTeam)
  for (const edge of directionEdges) {
    edge.source.dealt += edge.value
    edge.target.received += edge.value
  }

  const rosterNames = (team: 1 | 2) =>
    roster?.teams[team - 1]?.players.map((player) => player.name) ?? []
  const sourceNodes = orderTeam(
    [...players.values()].filter((player) => player.team === attackingTeam),
    rosterNames(attackingTeam),
    options.sourceOrder,
  )
  const targetNodes = orderTeam(
    [...players.values()].filter((player) => player.team === defendingTeam),
    rosterNames(defendingTeam),
    options.targetOrder,
  )
  const sources = cachedRank(
    sourceNodes,
    options.sourceOrder,
    (player) => player.name,
    (player) => player.dealt,
  )
  const edges = cachedRank(
    directionEdges,
    options.edgeOrder,
    (edge) => edge.key,
    (edge) => edge.value,
  )
  const total = directionEdges.reduce((sum, edge) => sum + edge.value, 0)
  const top3 = edges.slice(0, 3)

  const recipients = cachedRank(
    targetNodes.map((node): DamageFlowRecipient => {
      const incoming = directionEdges
        .filter((edge) => edge.target.name === node.name)
        .sort((a, b) => b.value - a.value || a.source.name.localeCompare(b.source.name))
      const leading = incoming[0]
      const leadingSource = leading && leading.value > 0 ? leading.source : null
      const leadingDamageTypes = leadingSource ? leading!.damageTypes : emptyDamageTypes()
      const otherDamageTypes = incoming
        .filter((edge) => edge !== leading || !leadingSource)
        .reduce(
          (damageTypes, edge) => addDamageTypes(damageTypes, edge.damageTypes),
          emptyDamageTypes(),
        )
      return {
        node,
        value: node.received,
        leadingSource,
        leadingValue: leadingSource ? leading!.value : 0,
        leadingShare: node.received > 0 && leadingSource ? leading!.value / node.received : 0,
        leadingDamageTypes,
        otherDamageTypes,
      }
    }),
    options.receivedOrder,
    (recipient) => recipient.node.name,
    (recipient) => recipient.value,
  )

  const explicitName = data?.highlightPlayerName?.trim() ? data.highlightPlayerName : undefined
  const explicitSpotlight = explicitName
    ? sourceNodes.find((player) => player.name === explicitName)
    : undefined
  const cachedSpotlight = options.spotlightName
    ? sourceNodes.find((player) => player.name === options.spotlightName)
    : undefined
  const spotlightUnavailable = !!explicitName && !explicitSpotlight
  const spotlight = spotlightUnavailable
    ? null
    : (explicitSpotlight ?? cachedSpotlight ?? sources[0] ?? null)
  const highlightPlayerName = explicitName ?? null
  const spotlightEdges = spotlight
    ? directionEdges.filter((edge) => edge.source.name === spotlight.name)
    : []
  const spotlightTargets = cachedRank(
    targetNodes.map((target): DamageFlowTarget => {
      const key = spotlight ? edgeKey(spotlight.name, target.name) : ''
      const value = spotlight
        ? (aggregated.values.get(key)?.value ?? (aggregated.invalid.has(key) ? null : 0))
        : null
      const damageTypes =
        value == null ? null : (aggregated.values.get(key)?.damageTypes ?? emptyDamageTypes())
      return {
        target,
        value,
        damageTypes,
        share:
          value != null && spotlight!.dealt > 0 ? value / spotlight!.dealt : value === 0 ? 0 : null,
      }
    }),
    options.targetOrder,
    (entry) => entry.target.name,
    (entry) => entry.value ?? -1,
  )

  const matrix = sourceNodes.map((source) => ({
    source,
    cells: targetNodes.map((target) => {
      const key = edgeKey(source.name, target.name)
      return {
        target,
        value: aggregated.values.get(key)?.value ?? (aggregated.invalid.has(key) ? null : 0),
      }
    }),
  }))

  return {
    view,
    showDamageTypes: data?.showDamageTypes !== false,
    attackingTeam,
    highlightPlayerName,
    spotlightUnavailable,
    sourceNodes,
    targetNodes,
    edges,
    total,
    top3,
    top3Share: total > 0 ? top3.reduce((sum, edge) => sum + edge.value, 0) / total : 0,
    sources,
    recipients,
    matrix,
    spotlight,
    spotlightTargets,
    maxEdge: Math.max(1, ...allEdges.map((edge) => edge.value)),
    maxReceived: Math.max(1, ...recipients.map((recipient) => recipient.value)),
    spotlightMax: Math.max(1, ...spotlightEdges.map((edge) => edge.value)),
    scopeLabel: formatDamageFlowScope(data),
  }
}
