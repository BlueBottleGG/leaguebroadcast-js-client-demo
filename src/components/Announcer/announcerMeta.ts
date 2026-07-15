import type { announcementParameter, announcerEvent } from '@bluebottle_gg/league-broadcast-client'
import { playerDisplayName } from '@/utils/playerDisplayName'

/**
 * The backend serializes `AnnouncementType` as its string name
 * (e.g. "TripleKill", "BaronSpawn"), not as a number.
 */
export type AnnouncementTypeName = string

export interface AnnouncementText {
  /** Small ceremonial line above the headline. */
  eyebrow?: string
  /** Big headline, only for major events ("TRIPLE KILL"). */
  title?: string
  /**
   * Single text line for minor events without a title.
   * Titled events stay title-only — the champion icons already tell the story.
   */
  detail?: string
}

export interface AnnouncementMeta {
  /** Higher wins when the queue overflows. */
  priority: number
  /** Dropped if it can't start displaying within this window. */
  ttlMs: number
  /** How long the banner stays on screen (uncontested). */
  displayMs: number
  /** Whether this event is a moment worth attaching the sponsor to. */
  brandEligible: boolean
  /** Optional bespoke visual treatment for exceptional moments. */
  variant?: 'gromp-grand'
  /** Suppress repeat events until the announcer is reset for the next game. */
  oncePerGame?: boolean
  text: (src?: announcementParameter, tgt?: announcementParameter) => AnnouncementText
}

type AnnouncementParameterWithDisplayName = announcementParameter & {
  displayName?: string
}

/** Resolve a human-readable name: player display name > champion name. */
export function paramDisplayName(p?: announcementParameter): string | undefined {
  if (!p) return undefined
  const withDisplayName = p as AnnouncementParameterWithDisplayName
  return (
    playerDisplayName(withDisplayName) ||
    playerDisplayName(p.member) ||
    p.champion?.name?.trim() ||
    undefined
  )
}

/** Rank within the kill-upgrade family: a higher rank replaces a lower one from the same player. */
export const MULTIKILL_RANK: Record<AnnouncementTypeName, number> = {
  Kill: 1,
  DoubleKill: 2,
  TripleKill: 3,
  QuadraKill: 4,
  PentaKill: 5,
}

const MAJOR = { ttlMs: 12000, displayMs: 3800, brandEligible: true }
const MINOR = { ttlMs: 6000, displayMs: 2800, brandEligible: false }

const slain = (src?: announcementParameter, tgt?: announcementParameter) => {
  const s = paramDisplayName(src)
  const t = paramDisplayName(tgt)
  return s && t ? `${s} has slain ${t}` : undefined
}

const DRAKE_NAMES: Record<string, string> = {
  Air: 'Cloud',
  Earth: 'Mountain',
  Fire: 'Infernal',
  Water: 'Ocean',
  Hextech: 'Hextech',
  Chemtech: 'Chemtech',
}

function drakeReveal(element: string): AnnouncementMeta {
  return {
    ...MINOR,
    priority: 20,
    text: () => ({ detail: `The next dragon will be ${DRAKE_NAMES[element]}` }),
  }
}

export const ANNOUNCEMENT_META: Record<AnnouncementTypeName, AnnouncementMeta> = {
  PentaKill: {
    ...MAJOR,
    ttlMs: 15000,
    displayMs: 4500,
    priority: 100,
    text: (src) => ({
      title: 'PENTAKILL',
      detail: paramDisplayName(src),
    }),
  },
  GrompKill: {
    ...MAJOR,
    ttlMs: 15000,
    displayMs: 6500,
    priority: 96,
    brandEligible: false,
    variant: 'gromp-grand',
    oncePerGame: true,
    text: (src) => ({
      eyebrow: 'THE FIRST GROMP HAS FALLEN',
      title: 'Lord Grompulus Kevin Ribbiton of Croaksworth',
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has ended a reign — and a name — of truly unreasonable length.`
        : 'A reign — and a name — of truly unreasonable length has ended.',
    }),
  },
  QuadraKill: {
    ...MAJOR,
    priority: 92,
    text: (src) => ({
      title: 'QUADRA KILL',
      detail: paramDisplayName(src),
    }),
  },
  Ace: {
    ...MAJOR,
    priority: 88,
    text: () => ({ title: 'ACE' }),
  },
  TripleKill: {
    ...MAJOR,
    priority: 84,
    text: (src) => ({
      title: 'TRIPLE KILL',
      detail: paramDisplayName(src),
    }),
  },
  BaronSteal: {
    ...MAJOR,
    priority: 80,
    text: (src) => ({
      title: 'BARON STOLEN',
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has stolen Baron Nashor`
        : undefined,
    }),
  },
  DragonSteal: {
    ...MAJOR,
    priority: 78,
    text: (src) => ({
      title: 'DRAGON STOLEN',
      detail: paramDisplayName(src) ? `${paramDisplayName(src)} has stolen the Dragon` : undefined,
    }),
  },
  HeraldSteal: {
    ...MAJOR,
    priority: 76,
    text: (src) => ({
      title: 'HERALD STOLEN',
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has stolen the Rift Herald`
        : undefined,
    }),
  },
  GrubSteal: {
    ...MAJOR,
    priority: 74,
    text: (src) => ({
      title: 'VOIDGRUB STOLEN',
      detail: paramDisplayName(src) ? `${paramDisplayName(src)} has stolen a Voidgrub` : undefined,
    }),
  },
  FirstBlood: {
    ...MAJOR,
    priority: 70,
    text: (src) => ({
      title: 'FIRST BLOOD',
      detail: paramDisplayName(src),
    }),
  },
  DoubleKill: {
    ...MAJOR,
    priority: 64,
    text: (src) => ({
      title: 'DOUBLE KILL',
      detail: paramDisplayName(src),
    }),
  },
  BaronKill: {
    ...MAJOR,
    priority: 60,
    text: (src) => ({
      title: 'BARON SLAIN',
      detail: paramDisplayName(src) ? `${paramDisplayName(src)} has slain Baron Nashor` : undefined,
    }),
  },
  DragonKill: {
    ...MAJOR,
    priority: 56,
    text: (src) => ({
      title: 'DRAGON SLAIN',
      detail: paramDisplayName(src) ? `${paramDisplayName(src)} has slain the Dragon` : undefined,
    }),
  },
  HeraldKill: {
    ...MAJOR,
    priority: 52,
    text: (src) => ({
      title: 'HERALD SLAIN',
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has slain the Rift Herald`
        : undefined,
    }),
  },
  GrubKill: {
    ...MINOR,
    priority: 48,
    brandEligible: true,
    text: (src) => ({
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has slain a Voidgrub`
        : 'A Voidgrub has been slain',
    }),
  },
  InhibitorKill: {
    ...MAJOR,
    priority: 46,
    text: (src) => ({
      title: 'INHIBITOR DESTROYED',
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has destroyed an inhibitor`
        : undefined,
    }),
  },
  FirstBrick: {
    ...MAJOR,
    priority: 44,
    text: (src) => ({
      title: 'FIRST TURRET',
      detail: paramDisplayName(src) ? `${paramDisplayName(src)} has destroyed a turret` : undefined,
    }),
  },
  TowerKill: {
    ...MINOR,
    priority: 40,
    text: (src) => ({
      detail: paramDisplayName(src)
        ? `${paramDisplayName(src)} has destroyed a turret`
        : 'A turret has been destroyed',
    }),
  },
  Kill: {
    ...MINOR,
    ttlMs: 7000,
    priority: 30,
    text: (src, tgt) => ({ detail: slain(src, tgt) ?? 'An enemy has been slain' }),
  },
  GameStart: {
    ...MINOR,
    priority: 26,
    displayMs: 3500,
    text: () => ({ detail: "Welcome to Summoner's Rift" }),
  },
  BaronSpawn: {
    ...MINOR,
    priority: 24,
    text: () => ({ detail: 'Baron Nashor has spawned' }),
  },
  DragonSpawn: {
    ...MINOR,
    priority: 22,
    text: () => ({ detail: 'The Dragon has spawned' }),
  },
  HeraldSpawn: {
    ...MINOR,
    priority: 20,
    text: () => ({ detail: 'The Rift Herald has spawned' }),
  },
  Dragon_Rift_Air: drakeReveal('Air'),
  Dragon_Rift_Earth: drakeReveal('Earth'),
  Dragon_Rift_Fire: drakeReveal('Fire'),
  Dragon_Rift_Water: drakeReveal('Water'),
  Dragon_Rift_Hextech: drakeReveal('Hextech'),
  Dragon_Rift_Chemtech: drakeReveal('Chemtech'),
  GrubSpawn: {
    ...MINOR,
    priority: 18,
    text: () => ({ detail: 'The Voidgrubs have spawned' }),
  },
  InhibitorSpawn: {
    ...MINOR,
    priority: 16,
    text: () => ({ detail: 'An inhibitor has respawned' }),
  },
  TowerSpawn: {
    ...MINOR,
    priority: 14,
    text: () => ({ detail: 'A turret has respawned' }),
  },
  MinionSpawn: {
    ...MINOR,
    priority: 12,
    text: () => ({ detail: 'Minions have spawned' }),
  },
  // "Unknown" is intentionally absent — events without meta are dropped.
}

/** Resolve the icon (cache path) for an announcement side: champion square, or the styled asset. */
export function announcementIcon(param?: announcerEvent['source']): string | undefined {
  return param?.champion?.squareImg ?? param?.asset
}
