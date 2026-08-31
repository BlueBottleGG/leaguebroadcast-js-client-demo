import assert from 'node:assert/strict'
import type { championData, championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import {
  collectStageActors,
  collectStageBanWalls,
  collectStagePickCards,
  collectStageTeamIdentities,
  planStageActorReconciliation,
  resolveStageCameraActiveSide,
  stageBanWallSignature,
  stagePickCardSignature,
  stageTeamIdentitySignature,
} from '../championStageState.ts'

function champion(alias: string): championData {
  return { alias, name: alias } as championData
}

function team(activePick = true, activeBan = true): championSelectTeam {
  return {
    slots: [
      { champion: champion('Ahri'), isActive: false },
      { champion: champion('HoveredPick'), isActive: activePick },
    ],
    bans: [
      { champion: champion('Akali'), isActive: false },
      { champion: champion('HoveredBan'), isActive: activeBan },
    ],
  } as championSelectTeam
}

const actors = collectStageActors(team(), team())

assert.deepEqual(
  actors.map(({ key, alias, kind, side }) => ({ key, alias, kind, side })),
  [
    { key: 'pick-blue-0', alias: 'Ahri', kind: 'pick', side: 'blue' },
    { key: 'pick-red-0', alias: 'Ahri', kind: 'pick', side: 'red' },
  ],
)

const pickCards = collectStagePickCards(team(), team())
assert.deepEqual(
  pickCards.map(({ key, champion, index, side }) => ({
    key,
    alias: champion?.alias,
    index,
    side,
  })),
  [
    { key: 'pick-card-blue-1', alias: 'HoveredPick', index: 1, side: 'blue' },
    { key: 'pick-card-red-1', alias: 'HoveredPick', index: 1, side: 'red' },
  ],
  'active pick slots should become stage cards even before they lock',
)
assert.equal(
  stagePickCardSignature(pickCards[0]!),
  'pick-card-blue-1:HoveredPick:',
  'hovered champion identity should invalidate the card texture',
)

const emptyHoverTeam = team()
if (emptyHoverTeam.slots?.[1]) emptyHoverTeam.slots[1].champion = undefined
assert.deepEqual(
  collectStagePickCards(emptyHoverTeam, undefined).map(({ key, champion }) => ({
    key,
    champion,
  })),
  [{ key: 'pick-card-blue-1', champion: undefined }],
  'the active card should still show its lane emblem before a champion is hovered',
)

const afterLocks = collectStageActors(team(false, false), undefined)
assert.deepEqual(
  afterLocks.map(({ key, alias }) => ({ key, alias })),
  [
    { key: 'pick-blue-0', alias: 'Ahri' },
    { key: 'pick-blue-1', alias: 'HoveredPick' },
  ],
  'newly committed picks should enter the 3D stage without treating bans as models',
)

assert.deepEqual(
  collectStagePickCards(team(false, false), undefined, new Set(['pick-blue-1'])).map(
    ({ key, champion }) => ({ key, alias: champion?.alias }),
  ),
  [{ key: 'pick-card-blue-1', alias: 'HoveredPick' }],
  'a committed pick should keep the same physical card until its model is ready',
)
assert.deepEqual(
  collectStagePickCards(team(false, false), undefined),
  [],
  'a ready committed pick should release its physical card',
)

const wallBans = collectStageBanWalls(team(false, false), undefined)
assert.deepEqual(
  wallBans.map(({ active, key, champion, index, side }) => ({
    active,
    key,
    alias: champion.alias,
    index,
    side,
  })),
  [
    { active: false, key: 'ban-wall-blue-0', alias: 'Akali', index: 0, side: 'blue' },
    { active: false, key: 'ban-wall-blue-1', alias: 'HoveredBan', index: 1, side: 'blue' },
  ],
  'committed bans should occupy settled wall portraits',
)
assert.equal(
  stageBanWallSignature(wallBans[0]!),
  'ban-wall-blue-0:Akali::locked',
  'ban artwork and status changes should invalidate the wall portrait',
)

const activeWallBans = collectStageBanWalls(team(), undefined)
assert.deepEqual(
  activeWallBans.map(({ active, key, champion }) => ({
    active,
    key,
    alias: champion.alias,
  })),
  [
    { active: false, key: 'ban-wall-blue-0', alias: 'Akali' },
    { active: true, key: 'ban-wall-blue-1', alias: 'HoveredBan' },
  ],
  'the hovered ban should appear in color in its final wall bay',
)

assert.deepEqual(
  collectStageActors(undefined, undefined),
  [],
  'a draft reset should empty the 3D stage',
)

const identities = collectStageTeamIdentities(
  {
    metaData: { name: 'Violet Ravens Berlin', tag: 'VRB' },
    scoreMatch: { wins: 2, losses: 1 },
  } as championSelectTeam,
  {
    metaData: { name: '  ', tag: 'MRS' },
    scoreMatch: { wins: 1.9, losses: 2 },
  } as championSelectTeam,
)
assert.deepEqual(identities, [
  { key: 'team-identity-blue', name: 'Violet Ravens Berlin', score: 2, side: 'blue' },
  { key: 'team-identity-red', name: 'MRS', score: 1, side: 'red' },
])
assert.equal(
  stageTeamIdentitySignature(identities[0]!),
  'team-identity-blue:Violet Ravens Berlin:2',
)
assert.deepEqual(
  collectStageTeamIdentities({ scoreMatch: { wins: Number.NaN } } as championSelectTeam, undefined),
  [{ key: 'team-identity-blue', name: 'BLUE TEAM', score: 0, side: 'blue' }],
  'missing names and malformed scores should retain a legible stage identity',
)

const beforeSwap = collectStageActors(
  {
    slots: [
      { champion: champion('Ahri'), isActive: false },
      { champion: champion('Akali'), isActive: false },
    ],
  } as championSelectTeam,
  undefined,
)
const afterSwap = collectStageActors(
  {
    slots: [
      { champion: champion('Akali'), isActive: false },
      { champion: champion('Ahri'), isActive: false },
    ],
  } as championSelectTeam,
  undefined,
)

assert.deepEqual(planStageActorReconciliation(beforeSwap, afterSwap), {
  addedKeys: [],
  assignments: [
    { currentKey: 'pick-blue-1', desiredKey: 'pick-blue-0' },
    { currentKey: 'pick-blue-0', desiredKey: 'pick-blue-1' },
  ],
  removedKeys: [],
})

const afterReplacement = collectStageActors(
  {
    slots: [
      { champion: champion('Akali'), isActive: false },
      { champion: champion('Lux'), isActive: false },
    ],
  } as championSelectTeam,
  undefined,
)

assert.deepEqual(planStageActorReconciliation(afterSwap, afterReplacement), {
  addedKeys: ['pick-blue-1'],
  assignments: [{ currentKey: 'pick-blue-0', desiredKey: 'pick-blue-0' }],
  removedKeys: ['pick-blue-1'],
})

const completedBlueTeam = {
  slots: Array.from({ length: 5 }, (_, index) => ({
    champion: champion(`Blue${index}`),
    isActive: false,
  })),
} as championSelectTeam
const completedRedTeam = {
  slots: Array.from({ length: 5 }, (_, index) => ({
    champion: champion(`Red${index}`),
    isActive: false,
  })),
} as championSelectTeam

assert.equal(
  resolveStageCameraActiveSide('red', true, completedBlueTeam, completedRedTeam),
  null,
  'a completed draft should center the camera even if an action side is stale',
)
assert.equal(
  resolveStageCameraActiveSide('blue', false, team(false, false), team(false, false)),
  null,
  'an inactive draft should always center the camera',
)
assert.equal(
  resolveStageCameraActiveSide(null, true, team(false, false), team(false, false)),
  null,
  'no active pick or ban should keep the camera neutral',
)

console.log('champion stage lock filtering and swap reconciliation passed')
