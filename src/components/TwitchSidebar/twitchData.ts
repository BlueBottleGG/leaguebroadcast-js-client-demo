export type TwitchKind = 'poll' | 'prediction' | 'chat'
export type TwitchStatus = 'active' | 'locked' | 'complete' | 'canceled'

export interface TwitchOption {
  id: string
  label: string
  value: number
  /** Percentage of all votes or channel points, from 0 to 100. */
  share: number
}

export interface TwitchModel {
  kind: TwitchKind
  key: string
  title: string
  status: TwitchStatus
  options: TwitchOption[]
  total: number
  /** UTC epoch milliseconds; null when the DTO supplies no usable timer. */
  endsAt: number | null
  winnerIds: string[]
  resultLabel: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

export function buildTwitchModel(kind: TwitchKind, payload: unknown): TwitchModel | null {
  const data = record(payload)
  if (!data) return null
  let status: TwitchStatus
  if (kind === 'chat') {
    if (typeof data.active !== 'boolean') return null
    status = data.active ? 'active' : 'complete'
  } else if (kind === 'poll' || kind === 'prediction') {
    switch (data.status) {
      case 'ACTIVE':
        status = 'active'
        break
      case 'LOCKED':
        if (kind !== 'prediction') return null
        status = 'locked'
        break
      case 'RESOLVED':
        if (kind !== 'prediction') return null
        status = 'complete'
        break
      case 'COMPLETED':
      case 'TERMINATED':
        if (kind !== 'poll') return null
        status = 'complete'
        break
      case 'ARCHIVED':
        if (kind !== 'poll') return null
        status = 'canceled'
        break
      case 'CANCELED':
        status = 'canceled'
        break
      default:
        return null
    }
  } else return null

  const source =
    kind === 'poll' ? data.choices : kind === 'prediction' ? data.outcomes : data.options
  if (!Array.isArray(source)) return null
  const options: TwitchOption[] = []
  for (const [index, entry] of source.entries()) {
    const option = record(entry)
    if (!option) continue
    const label = text(kind === 'chat' ? option.label : option.title)
    if (!label) continue
    options.push({
      id: text(option.id) || `${index}:${label}`,
      label,
      value: count(kind === 'prediction' ? option.channel_points : option.votes),
      share: 0,
    })
  }
  if (!options.length || new Set(options.map((option) => option.id)).size !== options.length)
    return null
  const total = options.reduce((sum, option) => sum + option.value, 0)
  if (!Number.isFinite(total)) return null
  for (const option of options) option.share = total > 0 ? (option.value / total) * 100 : 0

  const winnerIds: string[] = []
  let resultLabel = status === 'canceled' ? 'CANCELED' : ''
  if (status === 'complete') {
    if (kind === 'prediction') {
      // A resolved outcome wins even when nobody backed it. Stake share is not a result.
      const winner = options.find((option) => option.id === text(data.winning_outcome_id))
      if (winner) winnerIds.push(winner.id)
      resultLabel = winner ? 'WINNER' : 'RESULT UNAVAILABLE'
    } else if (total > 0) {
      const maximum = Math.max(...options.map((option) => option.value))
      winnerIds.push(
        ...options.filter((option) => option.value === maximum).map((option) => option.id),
      )
      resultLabel = winnerIds.length > 1 ? 'TIED' : 'WINNER'
    } else resultLabel = 'NO VOTES'
  }

  const title =
    kind === 'chat'
      ? ''
      : text(data.title) || (kind === 'poll' ? 'Twitch poll' : 'Twitch prediction')
  const start = kind === 'poll' ? data.started_at : data.created_at
  const startedAt =
    start instanceof Date ? start.getTime() : typeof start === 'string' ? Date.parse(start) : NaN
  const duration = kind === 'poll' ? data.duration : data.prediction_window
  const end =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? startedAt + duration * 1_000
      : NaN
  return {
    kind,
    key: `${kind}:${
      kind === 'chat'
        ? JSON.stringify(options.map((option) => option.label))
        : text(data.id) || JSON.stringify([title, Number.isFinite(startedAt) ? startedAt : null])
    }`,
    title,
    status,
    options,
    total,
    endsAt: kind !== 'chat' && Number.isFinite(end) ? end : null,
    winnerIds,
    resultLabel,
  }
}
