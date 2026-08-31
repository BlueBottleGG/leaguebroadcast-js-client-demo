import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'

export type HybridChampionSide = 'blue' | 'red'

export type HybridChampionModelStatus = 'loading' | 'ready' | 'failed'

export interface HybridChampionModelState {
  alias: string
  status: HybridChampionModelStatus
}

export type HybridChampionModelMedia = 'transparent' | 'model' | 'splash'

export interface HybridChampionSlot {
  alias: string
  index: number
  isActive: boolean
  key: string
  side: HybridChampionSide
}

export interface HybridChampionSlotOptions {
  includeActive: boolean
}

export function collectHybridChampionSlots(
  blueTeam: championSelectTeam | undefined,
  redTeam: championSelectTeam | undefined,
  options: HybridChampionSlotOptions,
): HybridChampionSlot[] {
  const result: HybridChampionSlot[] = []
  for (const [side, team] of [
    ['blue', blueTeam],
    ['red', redTeam],
  ] as const) {
    team?.slots?.forEach((slot, index) => {
      const alias = slot.champion?.alias?.trim()
      if (!alias || (slot.isActive && !options.includeActive)) return
      result.push({ alias, index, isActive: !!slot.isActive, key: `${side}-${index}`, side })
    })
  }
  return result
}

export function hybridChampionSlotSignature(slot: HybridChampionSlot): string {
  return `${slot.key}:${slot.alias}:${slot.isActive ? 'hover' : 'locked'}`
}

export function resolveHybridChampionModelStatus(
  alias: string | undefined,
  state: HybridChampionModelState | undefined,
): HybridChampionModelStatus | undefined {
  if (!alias) return undefined
  return state?.alias === alias ? state.status : 'loading'
}

export function hybridChampionModelMedia(
  status: HybridChampionModelStatus,
): HybridChampionModelMedia {
  if (status === 'ready') return 'model'
  if (status === 'failed') return 'splash'
  return 'transparent'
}
