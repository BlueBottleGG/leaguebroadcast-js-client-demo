import type { championData, championSelectTeam } from '@bluebottle_gg/league-broadcast-client'

export type StageSide = 'blue' | 'red'
export type StageActorKind = 'pick' | 'ban'

export interface StageChampionActor {
  key: string
  alias: string
  champion: championData
  index: number
  kind: StageActorKind
  side: StageSide
}

export interface StagePickCardDescriptor {
  key: string
  champion?: championData
  index: number
  side: StageSide
}

export interface StageBanWallDescriptor {
  active: boolean
  key: string
  champion: championData
  index: number
  side: StageSide
}

export interface StageTeamIdentityDescriptor {
  key: string
  name: string
  score: number
  side: StageSide
}

export interface StageActorAssignment {
  currentKey: string
  desiredKey: string
}

export interface StageActorReconciliation {
  addedKeys: string[]
  assignments: StageActorAssignment[]
  removedKeys: string[]
}

export function resolveStageCameraActiveSide(
  activeSide: StageSide | null,
  isDraftActive: boolean,
  blueTeam?: championSelectTeam,
  redTeam?: championSelectTeam,
): StageSide | null {
  const slots = [...(blueTeam?.slots ?? []), ...(redTeam?.slots ?? [])]
  const isDraftComplete =
    slots.length > 0 && slots.every((slot) => !!slot.champion && !slot.isActive)

  if (!isDraftActive || isDraftComplete) return null
  return activeSide
}

function collectTeamActors(
  team: championSelectTeam | undefined,
  side: StageSide,
): StageChampionActor[] {
  if (!team) return []

  const picks = (team.slots ?? []).flatMap((slot, index) => {
    if (!slot.champion || slot.isActive) return []
    return [
      {
        key: `pick-${side}-${index}`,
        alias: slot.champion.alias,
        champion: slot.champion,
        index,
        kind: 'pick' as const,
        side,
      },
    ]
  })

  return picks
}

function collectTeamPickCards(
  team: championSelectTeam | undefined,
  side: StageSide,
  pendingActorKeys: ReadonlySet<string>,
): StagePickCardDescriptor[] {
  if (!team) return []

  return (team.slots ?? []).flatMap((slot, index) => {
    const actorKey = `pick-${side}-${index}`
    if (!slot.isActive && !(slot.champion && pendingActorKeys.has(actorKey))) return []
    return [
      {
        key: `pick-card-${side}-${index}`,
        champion: slot.champion,
        index,
        side,
      },
    ]
  })
}

function collectTeamBanWalls(
  bans: championSelectTeam['bans'] | undefined,
  side: StageSide,
): StageBanWallDescriptor[] {
  if (!bans) return []

  return bans.flatMap((ban, index) => {
    if (!ban.champion) return []
    return [
      {
        active: !!ban.isActive,
        key: `ban-wall-${side}-${index}`,
        champion: ban.champion,
        index,
        side,
      },
    ]
  })
}

/**
 * Returns only committed picks. Bans remain in the existing 2D UI and never
 * enter the model-loading pipeline.
 */
export function collectStageActors(
  blueTeam: championSelectTeam | undefined,
  redTeam: championSelectTeam | undefined,
): StageChampionActor[] {
  return [...collectTeamActors(blueTeam, 'blue'), ...collectTeamActors(redTeam, 'red')]
}

/** Active pick slots render as physical stage cards. A committed slot can stay
 * in that same card while its champion model is still preparing. */
export function collectStagePickCards(
  blueTeam: championSelectTeam | undefined,
  redTeam: championSelectTeam | undefined,
  pendingActorKeys: ReadonlySet<string> = new Set(),
): StagePickCardDescriptor[] {
  return [
    ...collectTeamPickCards(blueTeam, 'blue', pendingActorKeys),
    ...collectTeamPickCards(redTeam, 'red', pendingActorKeys),
  ]
}

/** Hovered and locked bans render in their final wall bays; they deliberately
 * remain outside the champion-model pipeline. */
export function collectStageBanWalls(
  blueTeam: championSelectTeam | undefined,
  redTeam: championSelectTeam | undefined,
  blueBans = blueTeam?.bans,
  redBans = redTeam?.bans,
): StageBanWallDescriptor[] {
  return [...collectTeamBanWalls(blueBans, 'blue'), ...collectTeamBanWalls(redBans, 'red')]
}

function stageTeamIdentity(
  team: championSelectTeam | undefined,
  side: StageSide,
): StageTeamIdentityDescriptor | null {
  if (!team) return null

  const name =
    team.metaData?.name?.trim() || team.metaData?.tag?.trim() || `${side.toUpperCase()} TEAM`
  const rawScore = Number(team.scoreMatch?.wins ?? 0)

  return {
    key: `team-identity-${side}`,
    name,
    score: Number.isFinite(rawScore) ? Math.max(0, Math.trunc(rawScore)) : 0,
    side,
  }
}

/** Full-name and match-score copy rendered as physical floor graphics around
 * each team logo. Missing metadata gets a stable side label and invalid score
 * payloads resolve to zero rather than leaking NaN into a canvas texture. */
export function collectStageTeamIdentities(
  blueTeam: championSelectTeam | undefined,
  redTeam: championSelectTeam | undefined,
): StageTeamIdentityDescriptor[] {
  return [stageTeamIdentity(blueTeam, 'blue'), stageTeamIdentity(redTeam, 'red')].filter(
    (identity): identity is StageTeamIdentityDescriptor => identity !== null,
  )
}

export function stagePickCardSignature(card: StagePickCardDescriptor): string {
  const art = card.champion?.loadingImg || card.champion?.splashCenteredImg || ''
  return `${card.key}:${card.champion?.alias ?? ''}:${art}`
}

export function stageBanWallSignature(ban: StageBanWallDescriptor): string {
  const art = ban.champion.loadingImg || ban.champion.splashCenteredImg || ''
  return `${ban.key}:${ban.champion.alias}:${art}:${ban.active ? 'active' : 'locked'}`
}

export function stageTeamIdentitySignature(identity: StageTeamIdentityDescriptor): string {
  return `${identity.key}:${identity.name}:${identity.score}`
}

/** Skin selection is deliberately absent: the decorative draft stage is fixed
 * to the default champion skin (skin 0) by its backend endpoint contract. */
export function stageActorSignature(actor: StageChampionActor): string {
  return `${actor.key}:${actor.alias}`
}

/**
 * Match the next draft snapshot to the live stage actors. Exact slot matches
 * win first, then a champion that moved slots keeps its existing runtime.
 * This lets player swaps move a loaded model instead of rebuilding it.
 */
export function planStageActorReconciliation(
  currentActors: readonly StageChampionActor[],
  desiredActors: readonly StageChampionActor[],
): StageActorReconciliation {
  const currentByKey = new Map(currentActors.map((actor) => [actor.key, actor]))
  const claimedCurrentKeys = new Set<string>()
  const assignedDesiredKeys = new Set<string>()
  const assignments: StageActorAssignment[] = []

  for (const desired of desiredActors) {
    const current = currentByKey.get(desired.key)
    if (!current || current.alias !== desired.alias) continue
    claimedCurrentKeys.add(current.key)
    assignedDesiredKeys.add(desired.key)
    assignments.push({ currentKey: current.key, desiredKey: desired.key })
  }

  for (const desired of desiredActors) {
    if (assignedDesiredKeys.has(desired.key)) continue
    const current = currentActors.find(
      (actor) => !claimedCurrentKeys.has(actor.key) && actor.alias === desired.alias,
    )
    if (!current) continue
    claimedCurrentKeys.add(current.key)
    assignedDesiredKeys.add(desired.key)
    assignments.push({ currentKey: current.key, desiredKey: desired.key })
  }

  return {
    addedKeys: desiredActors
      .filter((actor) => !assignedDesiredKeys.has(actor.key))
      .map((actor) => actor.key),
    assignments,
    removedKeys: currentActors
      .filter((actor) => !claimedCurrentKeys.has(actor.key))
      .map((actor) => actor.key),
  }
}
