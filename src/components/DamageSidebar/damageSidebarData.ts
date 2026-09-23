import {
  aggregateSpellEntries,
  type damageRecapEntry,
  type damageRecapSpellEntry,
  type ingameDamageRecapData,
  type ingameDamageSplitData,
  type simpleChampionData,
} from '@bluebottle_gg/league-broadcast-client'
import { playerDisplayName } from '../../utils/playerDisplayName.ts'

export type DamageSidebarTypes = [physical: number, magic: number, trueDamage: number]
export interface DamageSidebarSpell {
  key: string
  name: string
  icon?: string
  damage: number
  type?: 0 | 1 | 2
}
export interface DamageSidebarEntry {
  key: string
  name: string
  championName: string
  portrait?: string
  team?: 1 | 2
  total: number
  share: number
  types: DamageSidebarTypes | null
  spells: DamageSidebarSpell[]
  otherDamage: number
}
export interface DamageSidebarModel {
  key: string
  direction: 'incoming' | 'outgoing'
  name: string
  championName: string
  portrait?: string
  team?: 1 | 2
  total: number
  types: DamageSidebarTypes | null
  entries: DamageSidebarEntry[]
}

const validDamage = (value: number) => Number.isFinite(value) && value >= 0
const tolerance = (total: number) => Math.max(0.01, total * 1e-6)
const damageType = (value: unknown): 0 | 1 | 2 | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const key = String(value).toLowerCase()
  return key === 'physical' || key === '0'
    ? 0
    : key === 'magic' || key === '1'
      ? 1
      : key === 'true' || key === '2'
        ? 2
        : undefined
}

function typesFor(
  map: Record<string, number> | undefined,
  total: number,
): DamageSidebarTypes | null {
  if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length) return null
  const values: DamageSidebarTypes = [0, 0, 0]
  for (const [key, amount] of Object.entries(map)) {
    const type = damageType(key)
    if (!validDamage(amount) || (type == null && amount > 0)) return null
    if (type != null) values[type] += amount
  }
  const sum = values.reduce((a, b) => a + b, 0)
  // Partial or inconsistent splits are unavailable; never label the remainder physical.
  return Number.isFinite(sum) && Math.abs(sum - total) <= tolerance(total) ? values : null
}

function identity(rawName: string, displayName: string, champion?: simpleChampionData) {
  let name = rawName
  if (!champion) {
    if (/^minion_t/i.test(rawName)) name = 'Minions'
    else if (/^turret_t/i.test(rawName)) name = 'Turrets'
    else if (/^(baron(?: nashor)?$|SRU_Baron)/i.test(rawName)) name = 'Baron Nashor'
    else if (/^SRU_/i.test(rawName))
      name = rawName.split('.')[0]!.replace(/_\d+$/, '').replace(/^SRU_/i, '')
  }
  return {
    name: playerDisplayName(
      { name, displayName: typeof displayName === 'string' ? displayName : undefined },
      'Unknown',
    ),
    championName: typeof champion?.name === 'string' ? champion.name : '',
    portrait: typeof champion?.squareImg === 'string' ? champion.squareImg || undefined : undefined,
  }
}

function groupKey(entry: damageRecapEntry) {
  if (entry.source) return JSON.stringify([entry.team, entry.sourceName])
  const raw = entry.sourceName
  const group = /^minion_t/i.test(raw)
    ? /^minion_t1/i.test(raw)
      ? 'minion-order'
      : 'minion-chaos'
    : /^turret_t/i.test(raw)
      ? /^turret_torder/i.test(raw)
        ? 'turret-order'
        : 'turret-chaos'
      : /^(baron(?: nashor)?$|SRU_Baron)/i.test(raw)
        ? 'baron'
        : /^SRU_/i.test(raw)
          ? raw.split('.')[0]!.replace(/_\d+$/, '')
          : raw
  return JSON.stringify([entry.team, group])
}

/** Preserve every iconless damage type before filling the remaining detail slots. */
export function summarizeDamageSpells(
  spells: DamageSidebarSpell[],
  total: number,
  failedIcons: ReadonlySet<string> = new Set(),
) {
  const valid = spells.filter((spell) => validDamage(spell.damage) && spell.damage > 0)
  const sum = valid.reduce((value, spell) => value + spell.damage, 0)
  if (!validDamage(total) || !Number.isFinite(sum) || sum > total + tolerance(total))
    return { spells: [] as DamageSidebarSpell[], otherDamage: validDamage(total) ? total : 0 }
  const missing = new Map<DamageSidebarSpell['type'], DamageSidebarSpell>()
  const pictured: DamageSidebarSpell[] = []
  for (const spell of valid) {
    if (spell.icon?.trim() && !failedIcons.has(spell.icon)) {
      pictured.push(spell)
      continue
    }
    const existing = missing.get(spell.type)
    if (existing) existing.damage += spell.damage
    else
      missing.set(spell.type, {
        key: JSON.stringify(['missing-icon', spell.type ?? 'unknown']),
        name:
          spell.type == null
            ? 'Unknown damage'
            : ['Physical damage', 'Magic damage', 'True damage'][spell.type]!,
        damage: spell.damage,
        type: spell.type,
      })
  }
  const byDamage = (a: DamageSidebarSpell, b: DamageSidebarSpell) =>
    b.damage - a.damage || a.key.localeCompare(b.key)
  const shown = [
    ...missing.values(),
    ...pictured.sort(byDamage).slice(0, Math.max(0, 3 - missing.size)),
  ].sort(byDamage)
  return {
    spells: shown,
    otherDamage: Math.max(0, total - shown.reduce((sum, spell) => sum + spell.damage, 0)),
  }
}

function spellBreakdown(raw: damageRecapSpellEntry[], total: number) {
  const valid = raw
    .filter((spell) => spell && validDamage(spell.damage) && spell.damage > 0)
    .map((spell): damageRecapSpellEntry => {
      const data = spell.spellData
      const icon = typeof data?.iconAsset === 'string' ? data.iconAsset.trim() : ''
      const type = damageType(spell.damageType) ?? 3
      return {
        damage: spell.damage,
        damageType: type,
        // The SDK drops absent metadata; an iconless type bucket keeps that damage available.
        spellData: {
          spellName:
            icon && typeof data?.spellName === 'string' ? data.spellName : `Missing icon ${type}`,
          iconAsset: icon,
          nativeBinHash: 0,
          classification: icon ? data?.classification : undefined,
        },
      }
    })
  const all = aggregateSpellEntries(valid)
  const sum = all.reduce((value, spell) => value + spell.damage, 0)
  const spells: DamageSidebarSpell[] =
    !Number.isFinite(sum) || sum > total + tolerance(total)
      ? []
      : all.map((spell) => {
          const data = spell.spellData
          const classification = data?.classification
          const name =
            classification === 2
              ? 'Basic attacks'
              : classification === 3
                ? 'Critical attacks'
                : data?.spellName || 'Unknown spell'
          const key = classification === 2 || classification === 3 ? name : data?.iconAsset || name
          return {
            key: JSON.stringify([key, spell.damageType]),
            name,
            icon: data?.iconAsset || undefined,
            damage: spell.damage,
            type: damageType(spell.damageType),
          }
        })
  return {
    spells,
    otherDamage: Math.max(0, total - spells.reduce((sum, spell) => sum + spell.damage, 0)),
  }
}

function buildEntries(raw: damageRecapEntry[], total: number): DamageSidebarEntry[] | null {
  if (
    !Array.isArray(raw) ||
    raw.some(
      (entry) =>
        !entry ||
        !validDamage(entry.totalDamage) ||
        typeof entry.sourceName !== 'string' ||
        !entry.sourceName.trim(),
    )
  )
    return null
  const groups = new Map<string, { entry: DamageSidebarEntry; spells: damageRecapSpellEntry[] }>()
  for (const rawEntry of raw) {
    const key = groupKey(rawEntry)
    const types = typesFor(rawEntry.damageByType, rawEntry.totalDamage)
    const existing = groups.get(key)
    const spells = Array.isArray(rawEntry.spells) ? rawEntry.spells : []
    if (existing) {
      existing.entry.total += rawEntry.totalDamage
      existing.entry.types =
        existing.entry.types && types
          ? (existing.entry.types.map((value, i) => value + types[i]!) as DamageSidebarTypes)
          : null
      existing.spells.push(...spells)
    } else {
      groups.set(key, {
        entry: {
          key,
          ...identity(rawEntry.sourceName, rawEntry.sourceDisplayName, rawEntry.source),
          team: rawEntry.team === 1 || rawEntry.team === 2 ? rawEntry.team : undefined,
          total: rawEntry.totalDamage,
          share: 0,
          types,
          spells: [],
          otherDamage: 0,
        },
        spells: [...spells],
      })
    }
  }
  const entries = [...groups.values()].map(({ entry, spells }) => ({
    ...entry,
    share: entry.total / total,
    ...spellBreakdown(spells, entry.total),
  }))
  const sum = entries.reduce((value, entry) => value + entry.total, 0)
  if (!Number.isFinite(sum) || sum > total + tolerance(total)) return null
  return entries
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))
}

export function buildIncomingDamage(
  recap?: ingameDamageRecapData | null,
): DamageSidebarModel | null {
  if (
    !recap ||
    typeof recap.victimName !== 'string' ||
    !recap.victimName.trim() ||
    (recap.displayMode != null && !Number.isFinite(recap.displayMode)) ||
    ((recap.displayMode ?? 3) & 2) === 0 ||
    ['baron', 'baron nashor', 'dragon'].includes(recap.victimName?.toLowerCase()) ||
    !validDamage(recap.totalDamageReceived) ||
    recap.totalDamageReceived === 0
  )
    return null
  const total = recap.totalDamageReceived
  const entries = buildEntries(recap.entries, total)
  if (!entries?.length) return null
  const typed = entries.every((entry) => entry.types)
    ? entries.reduce<DamageSidebarTypes>(
        (sum, entry) => sum.map((value, i) => value + entry.types![i]!) as DamageSidebarTypes,
        [0, 0, 0],
      )
    : null
  return {
    key: JSON.stringify(['incoming', recap.victimName]),
    direction: 'incoming',
    ...identity(recap.victimName, recap.victimDisplayName, recap.victim),
    total,
    entries,
    types: typed ? typesFor({ 0: typed[0], 1: typed[1], 2: typed[2] }, total) : null,
  }
}

export function buildOutgoingDamage(
  split?: ingameDamageSplitData | null,
): DamageSidebarModel | null {
  if (
    !split ||
    typeof split.sourceName !== 'string' ||
    !split.sourceName.trim() ||
    !validDamage(split.totalDamageDealt) ||
    split.totalDamageDealt === 0 ||
    !Array.isArray(split.targets)
  )
    return null
  const total = split.totalDamageDealt
  const entries = buildEntries(
    split.targets.map(
      (target) =>
        target && {
          sourceName: target.targetName,
          sourceDisplayName: target.targetDisplayName,
          source: target.target,
          team: target.team,
          totalDamage: target.totalDamage,
          damageByType: target.damageByType,
          spells: target.spells,
        },
    ),
    total,
  )
  if (!entries?.length) return null
  return {
    key: JSON.stringify(['outgoing', split.sourceName]),
    direction: 'outgoing',
    ...identity(split.sourceName, split.sourceDisplayName, split.source),
    total,
    entries,
    types: typesFor(split.damageByType, total),
  }
}
