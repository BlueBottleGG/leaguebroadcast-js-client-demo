import {
  BestOfType,
  PickBanPhase,
  TeamMemberRole,
  type ChampSelectSnapshot,
  type champSelectStateData,
  type championData,
  type championSelectTeam,
  type simpleChampionData,
  type teamMember,
} from '@bluebottle_gg/league-broadcast-client'

// -- flag ---------------------------------------------------------------------

let flagChecked = false
let enabled = false
let variant = ''

export function isMockCsEnabled(): boolean {
  if (!flagChecked) {
    flagChecked = true
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      enabled = params.has('mockcs')
      variant = params.get('mockcs') ?? ''
    }
  }
  return enabled
}

// -- champion fixtures --------------------------------------------------------

const CHAMPS: Record<number, string> = {
  266: 'Aatrox',
  103: 'Ahri',
  84: 'Akali',
  12: 'Alistar',
  32: 'Amumu',
  22: 'Ashe',
  268: 'Azir',
  53: 'Blitzcrank',
  51: 'Caitlyn',
  122: 'Darius',
  131: 'Diana',
  81: 'Ezreal',
  114: 'Fiora',
  86: 'Garen',
  104: 'Graves',
  39: 'Irelia',
  202: 'Jhin',
  64: 'LeeSin',
  99: 'Lux',
  11: 'MasterYi',
}

function iconUrl(id: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`
}
function centeredUrl(id: number): string {
  return `https://cdn.communitydragon.org/latest/champion/${id}/splash-art/centered`
}
function portraitUrl(id: number): string {
  return `https://cdn.communitydragon.org/latest/champion/${id}/portrait`
}

function champ(id: number): championData {
  return {
    id,
    alias: CHAMPS[id] ?? String(id),
    name: CHAMPS[id] ?? String(id),
    attackSpeed: 0,
    splashCenteredImg: centeredUrl(id),
    splashImg: centeredUrl(id),
    loadingImg: portraitUrl(id),
    squareImg: iconUrl(id),
    tileImg: iconUrl(id),
    spells: [],
    skins: {},
  }
}

function simple(id: number): simpleChampionData {
  return {
    id,
    alias: CHAMPS[id] ?? String(id),
    name: CHAMPS[id] ?? String(id),
    splashCenteredImg: centeredUrl(id),
    splashImg: centeredUrl(id),
    loadingImg: portraitUrl(id),
    squareImg: iconUrl(id),
    tileImg: iconUrl(id),
  }
}

// deterministic pseudo-random champion statistics (percent scale, like the
// backend sends alongside a locked pick)
function statsFor(id: number) {
  return {
    winRate: 42 + (id % 17) + (id % 7) / 10,
    pickRate: 4 + (id % 23) + (id % 5) / 10,
    banRate: 2 + (id % 31) + (id % 3) / 10,
  }
}

const BLUE_PLAYERS = ['Impact', 'Blaber', 'Faker', 'Ruler', 'CoreJJ']
const RED_PLAYERS = ['Zeus', 'Oner', 'Chovy', 'Gumayusi', 'Keria']
// worst case: names can be up to 16 characters (variant flag "long")
const BLUE_PLAYERS_LONG = [
  'TheTopLaneTitan1',
  'JungleDifference',
  'MidLaneMaestro16',
  'BottomLaneCarry1',
  'SupportSavior123',
]
const RED_PLAYERS_LONG = [
  'SixteenCharacter',
  'MaximumLengthIGN',
  'ReallyLongName16',
  'AnotherLongName1',
  'FinalLongName123',
]
const BLUE_COACH = 'kkOma'
const RED_COACH = 'Daeny'

// deterministic puuid-shaped id so slot.player matches a member puuid (like the
// real backend, where slot.player is a puuid, not a display name)
function puuid(team: number, n: number): string {
  const tail = String(team * 100 + n).padStart(12, '0')
  return `00000000-0000-0000-0000-${tail}`
}

function member(team: number, n: number, name: string, role: TeamMemberRole): teamMember {
  return {
    memberId: team * 100 + n,
    teamId: team,
    alias: name,
    puuid: puuid(team, n),
    isActive: false,
    tag: '',
    role,
    familyName: '',
    givenName: '',
    displayName: name,
  }
}

function makeTeam(
  index: number,
  players: string[],
  coach: string,
  slotCount: number,
  score: { match: number; seasonW: number; seasonL: number },
  meta: { name: string; tag: string },
): championSelectTeam {
  const members: teamMember[] = players.map((p, i) => member(index, i, p, TeamMemberRole.Player))
  members.push(member(index, 90, coach, TeamMemberRole.Coach))

  const slots = Array.from({ length: slotCount }, (_, i) => ({
    id: index * 10 + i,
    isActive: false,
    // real backend sends a puuid here, not a display name
    player: puuid(index, i),
    summonerSpells: [],
    champion: undefined as championData | undefined,
  }))
  const bans = Array.from({ length: 5 }, () => ({
    isActive: false,
    champion: undefined as championData | undefined,
  }))
  return {
    metaData: {
      members,
      teamId: index,
      name: meta.name,
      tag: meta.tag,
      isActive: false,
      iconUri: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${index === 0 ? 5008 : 5300}.jpg`,
    },
    bans,
    slots,
    timeline: [],
    index,
    scoreMatch: { wins: score.match, losses: 0 },
    scoreSeason: { wins: score.seasonW, losses: score.seasonL },
    fearlessBans: {},
  }
}

// role-ordered fearless bans, 5 per prior game (up to 4 games), generated by
// cycling the champion pool. Keys are 0-based like the real backend.
const CHAMP_IDS = Object.keys(CHAMPS).map(Number)
function genFearless(games: number, offset: number) {
  const out: { [key: number]: simpleChampionData[] } = {}
  for (let g = 0; g < games; g++) {
    out[g] = Array.from({ length: 5 }, (_, i) =>
      simple(CHAMP_IDS[(g * 5 + i + offset) % CHAMP_IDS.length] ?? 266),
    )
  }
  return out
}

// variant flags combine with "-", e.g. ?mockcs=g4-long or ?mockcs=3v5
function buildFixture(): champSelectStateData {
  const flags = variant.split('-')
  const [blueSlots, redSlots] = flags.includes('3v5')
    ? [3, 5]
    : flags.includes('4v4')
      ? [4, 4]
      : [5, 5]
  const gFlag = flags.find((f) => /^g\d+$/.test(f))
  const fearlessGames = gFlag ? Math.max(1, Math.min(4, Number(gFlag.slice(1)))) : 3
  const long = flags.includes('long')

  const blue = makeTeam(
    0,
    long ? BLUE_PLAYERS_LONG : BLUE_PLAYERS,
    BLUE_COACH,
    blueSlots,
    { match: 2, seasonW: 24, seasonL: 6 },
    { name: 'Blue Bottle', tag: 'BB' },
  )
  const red = makeTeam(
    1,
    long ? RED_PLAYERS_LONG : RED_PLAYERS,
    RED_COACH,
    redSlots,
    { match: 1, seasonW: 18, seasonL: 12 },
    { name: 'Red Rockets', tag: 'RR' },
  )

  blue.fearlessBans = genFearless(fearlessGames, 0)
  red.fearlessBans = genFearless(fearlessGames, 10)

  // current game bans (all 5 each)
  const blueBanIds = [7, 245, 555, 350, 89]
  const redBanIds = [161, 526, 200, 421, 875]
  blue.bans.forEach((b, i) => (b.champion = champ(blueBanIds[i] ?? 0)))
  red.bans.forEach((b, i) => (b.champion = champ(redBanIds[i] ?? 0)))

  // some locked picks (stats come with them, like the real backend)
  const bluePicks = [266, 64, 103]
  const redPicks = [86, 11]
  bluePicks.forEach((id, i) => {
    if (blue.slots[i]) {
      blue.slots[i].champion = champ(id)
      blue.slots[i].championStatistics = statsFor(id)
    }
  })
  redPicks.forEach((id, i) => {
    if (red.slots[i]) {
      red.slots[i].champion = champ(id)
      red.slots[i].championStatistics = statsFor(id)
    }
  })

  return {
    isActive: true,
    isConnected: true,
    isTestingEnvironment: true,
    blueTeam: blue,
    redTeam: red,
    metaData: {
      bestOfType: BestOfType.BestOf5,
      patch: '14.13',
      performanceData: {} as champSelectStateData['metaData']['performanceData'],
    },
    timer: {
      phaseName: PickBanPhase.PICK2,
      phaseDuration: 30,
      timeRemaining: 30,
    },
  }
}

// -- reactive store -----------------------------------------------------------

isMockCsEnabled() // resolve variant from URL before building the fixture
let state: champSelectStateData = buildFixture()
let version = 0
const listeners = new Set<() => void>()

export function mockSnapshot(): ChampSelectSnapshot {
  return { champSelectData: state, isActive: state.isActive, version }
}

export function subscribeMock(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notify() {
  version++
  listeners.forEach((l) => l())
}

// Rebuild state preserving unchanged slot/ban refs so only touched cards
// re-render — keeps CSS transitions (flex-grow emphasis) from restarting.
function commit(mutations: {
  timer?: Partial<champSelectStateData['timer']>
  blueSlot?: { index: number; patch: Partial<pickMut> }
  redSlot?: { index: number; patch: Partial<pickMut> }
  blueBan?: { index: number; patch: Partial<banMut> }
  redBan?: { index: number; patch: Partial<banMut> }
}) {
  const next: champSelectStateData = { ...state }

  if (mutations.timer) {
    next.timer = { ...state.timer, ...mutations.timer }
  }

  const applyTeam = (
    teamKey: 'blueTeam' | 'redTeam',
    slotMut?: { index: number; patch: Partial<pickMut> },
    banMut?: { index: number; patch: Partial<banMut> },
  ) => {
    if (!slotMut && !banMut) return
    const team = { ...state[teamKey] }
    if (slotMut) {
      team.slots = state[teamKey].slots.map((s, i) =>
        i === slotMut.index ? { ...s, ...slotMut.patch } : s,
      )
    }
    if (banMut) {
      team.bans = state[teamKey].bans.map((b, i) =>
        i === banMut.index ? { ...b, ...banMut.patch } : b,
      )
    }
    next[teamKey] = team
  }

  applyTeam('blueTeam', mutations.blueSlot, mutations.blueBan)
  applyTeam('redTeam', mutations.redSlot, mutations.redBan)

  state = next
  notify()
}

type pickMut = champSelectStateData['blueTeam']['slots'][number]
type banMut = champSelectStateData['blueTeam']['bans'][number]

// -- simulator ----------------------------------------------------------------

interface Action {
  team: 'blue' | 'red'
  kind: 'ban' | 'pick'
  index: number
  champId: number
}

// remaining draft actions to walk through (a red ban, then alternating picks)
function remainingActions(): Action[] {
  const acts: Action[] = []
  // exercise one active ban (red ban slot already has a champ, re-hover it);
  // use a champ from the named fixture pool so the ban flash shows a name
  acts.push({ team: 'red', kind: 'ban', index: 4, champId: 268 })

  const blueLeft = [114, 104].map((id, i) => ({
    team: 'blue' as const,
    kind: 'pick' as const,
    index: 3 + i,
    champId: id,
  }))
  const redLeft = [39, 202, 12].map((id, i) => ({
    team: 'red' as const,
    kind: 'pick' as const,
    index: 2 + i,
    champId: id,
  }))
  // interleave
  const maxLen = Math.max(blueLeft.length, redLeft.length)
  for (let i = 0; i < maxLen; i++) {
    const r = redLeft[i]
    if (r) acts.push(r)
    const b = blueLeft[i]
    if (b) acts.push(b)
  }
  return acts
}

let started = false

export function startMockSimulation(): void {
  if (started || !isMockCsEnabled()) return
  started = true

  let actions = remainingActions()
  let step = 0 // seconds within the current action window (~7s per action)
  const WINDOW = 7

  const slotKey = (a: Action) =>
    a.kind === 'ban'
      ? a.team === 'blue'
        ? ('blueBan' as const)
        : ('redBan' as const)
      : a.team === 'blue'
        ? ('blueSlot' as const)
        : ('redSlot' as const)

  setInterval(() => {
    if (actions.length === 0) {
      // loop back to a mid-draft snapshot and run forever
      state = buildFixture()
      actions = remainingActions()
      step = 0
      notify()
      return
    }

    const action = actions[0]
    if (!action) return
    const key = slotKey(action)

    // occasionally simulate a phase reset: the timer jumps UP mid-window with
    // no slot change, to exercise the "snap instead of animate up" fix (#4).
    if (step === 4 && Math.random() < 0.35) {
      step = 0
      commit({
        timer: {
          timeRemaining: WINDOW,
          phaseDuration: WINDOW,
          phaseName: action.kind === 'ban' ? PickBanPhase.BAN2 : PickBanPhase.PICK2,
        },
      })
      step = 1
      return
    }

    const patch: Partial<pickMut & banMut> = {}
    if (step === 0) patch.isActive = true
    if (step === 2) patch.champion = champ(action.champId)

    const timer: Partial<champSelectStateData['timer']> = {
      timeRemaining: Math.max(0, WINDOW - step),
      phaseDuration: WINDOW,
      phaseName: action.kind === 'ban' ? PickBanPhase.BAN2 : PickBanPhase.PICK2,
    }

    const locking = step >= WINDOW - 1
    if (locking) {
      patch.isActive = false
      patch.champion = champ(action.champId)
      // stats arrive with (well, just after) a locked pick on the real backend
      if (action.kind === 'pick') patch.championStatistics = statsFor(action.champId)
    }

    // only touch the slot on steps that actually change it — keeps the active
    // card's ref (and its flex-grow transition) stable on timer-only ticks
    const slotMut = Object.keys(patch).length > 0 ? { [key]: { index: action.index, patch } } : {}
    commit({ timer, ...slotMut })

    if (locking) {
      actions.shift()
      step = 0
    } else {
      step++
    }
  }, 1000)
}
