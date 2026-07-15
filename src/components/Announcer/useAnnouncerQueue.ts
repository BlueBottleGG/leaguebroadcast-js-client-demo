import { onUnmounted, ref, type Ref } from 'vue'
import type { announcerEvent } from '@bluebottle_gg/league-broadcast-client'
import {
  ANNOUNCEMENT_META,
  MULTIKILL_RANK,
  announcementIcon,
  type AnnouncementMeta,
} from './announcerMeta'

export interface ActiveAnnouncement {
  id: number
  type: string
  eyebrow?: string
  title?: string
  detail?: string
  variant?: AnnouncementMeta['variant']
  /** Cache paths — resolve with client.getCacheUrl(). */
  sourceIcon?: string
  targetIcon?: string
  /** 1 = Order, 2 = Chaos, anything else = neutral. */
  team: number
  branded: boolean
}

interface QueuedItem {
  id: number
  event: announcerEvent
  type: string
  meta: AnnouncementMeta
  enqueuedAt: number
}

/** Max announcements waiting behind the visible one; beyond this, lowest priority is dropped. */
const MAX_PENDING = 3
/** When something is waiting, the visible banner gets cut short to this remaining time. */
const CONTESTED_REMAINING_MS = 1700
/** Pause between one banner leaving and the next entering (matches the exit transition). */
const SWAP_GAP_MS = 300
/** Minimum time between two branded banners. */
const BRAND_COOLDOWN_MS = 90_000

function isScuttleKill(type: string): boolean {
  return /^Scuttle(?:Crab)?Kill$/i.test(type)
}

/**
 * Single-slot announcer queue.
 *
 * - One banner shows at a time; the rest wait in a priority queue.
 * - Multikills upgrade in place (a TripleKill replaces that player's queued/visible DoubleKill).
 * - Pile-ups shorten the visible banner instead of queueing endlessly; overflow and
 *   stale (past-TTL) announcements are dropped, lowest priority first.
 * - Branding is decided when a banner goes live: brand-eligible events carry the sponsor
 *   at most once per cooldown.
 */
export function useAnnouncerQueue(options?: {
  brandCooldownMs?: number
  /** Freeze the first displayed banner forever (screenshot/debug aid). */
  freeze?: boolean
}) {
  const brandCooldownMs = options?.brandCooldownMs ?? BRAND_COOLDOWN_MS

  const current: Ref<ActiveAnnouncement | null> = ref(null)
  const pending: QueuedItem[] = []
  const seenOncePerGame = new Set<string>()

  let nextId = 0
  let endsAt = 0
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let swapTimer: ReturnType<typeof setTimeout> | undefined
  let currentItem: QueuedItem | null = null
  let lastBrandedAt = -Infinity

  function sourceChampionId(e: announcerEvent): number | undefined {
    return e.source?.champion?.id
  }

  function toActive(item: QueuedItem, branded: boolean): ActiveAnnouncement {
    const src = item.event.source
    const tgt = item.event.target
    const text = item.meta.text(src, tgt)
    return {
      id: item.id,
      type: item.type,
      eyebrow: text.eyebrow,
      title: text.title,
      detail: text.detail,
      variant: item.meta.variant,
      sourceIcon: announcementIcon(src),
      targetIcon: announcementIcon(tgt),
      team: src?.team ?? 0,
      branded,
    }
  }

  function show(item: QueuedItem, carryBranded = false) {
    currentItem = item
    const now = performance.now()
    const branded =
      carryBranded || (item.meta.brandEligible && now - lastBrandedAt >= brandCooldownMs)
    if (branded && !carryBranded) lastBrandedAt = now

    current.value = toActive(item, branded)

    if (options?.freeze) return

    // With a line behind us, don't linger.
    const displayMs =
      pending.length > 0
        ? Math.min(item.meta.displayMs, CONTESTED_REMAINING_MS + 800)
        : item.meta.displayMs
    endsAt = now + displayMs
    scheduleHide()
  }

  function scheduleHide() {
    clearTimeout(hideTimer)
    const delay = Math.max(0, endsAt - performance.now())
    hideTimer = setTimeout(() => {
      current.value = null
      currentItem = null
      swapTimer = setTimeout(advance, SWAP_GAP_MS)
    }, delay)
  }

  function advance() {
    swapTimer = undefined
    const now = performance.now()
    // Skip announcements that went stale while waiting.
    let next: QueuedItem | undefined
    while ((next = pending.shift())) {
      if (now - next.enqueuedAt <= next.meta.ttlMs) break
    }
    if (next) show(next)
  }

  function insertPending(item: QueuedItem) {
    pending.push(item)
    pending.sort((a, b) => b.meta.priority - a.meta.priority || a.enqueuedAt - b.enqueuedAt)
    // Overflow: the sort already put the least important last.
    while (pending.length > MAX_PENDING) pending.pop()
  }

  function enqueue(event: announcerEvent) {
    const type = String(event.type)
    if (isScuttleKill(type)) return

    const meta = ANNOUNCEMENT_META[type]
    if (!meta) return
    if (meta.oncePerGame) {
      if (seenOncePerGame.has(type)) return
      seenOncePerGame.add(type)
    }

    const item: QueuedItem = {
      id: nextId++,
      event,
      type,
      meta,
      enqueuedAt: performance.now(),
    }

    // Multikill upgrade: replace lower kills by the same champion, queued or visible.
    const rank = MULTIKILL_RANK[type]
    const champId = sourceChampionId(event)
    if (rank !== undefined && rank >= 2 && champId !== undefined) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i]!
        const pRank = MULTIKILL_RANK[p.type]
        if (pRank !== undefined && pRank < rank && sourceChampionId(p.event) === champId) {
          pending.splice(i, 1)
        }
      }
      if (currentItem) {
        const cRank = MULTIKILL_RANK[currentItem.type]
        if (
          cRank !== undefined &&
          cRank < rank &&
          sourceChampionId(currentItem.event) === champId
        ) {
          clearTimeout(hideTimer)
          // An upgrade keeps its sponsor: the brand shouldn't pop out mid-swap.
          show(item, current.value?.branded ?? false)
          return
        }
      }
    }

    // FirstBlood always accompanies a plain Kill for the same champion — drop the redundant one.
    if (type === 'FirstBlood' && champId !== undefined) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i]!
        if (p.type === 'Kill' && sourceChampionId(p.event) === champId) {
          pending.splice(i, 1)
        }
      }
    }

    // Idle (nothing visible, no swap in flight) — show immediately.
    if (!currentItem && swapTimer === undefined) {
      show(item)
      return
    }

    insertPending(item)

    // Someone is waiting now — cut the visible banner short.
    if (currentItem && !options?.freeze) {
      const now = performance.now()
      if (endsAt - now > CONTESTED_REMAINING_MS) {
        endsAt = now + CONTESTED_REMAINING_MS
        scheduleHide()
      }
    }
  }

  function clear() {
    clearTimeout(hideTimer)
    clearTimeout(swapTimer)
    swapTimer = undefined
    pending.length = 0
    currentItem = null
    current.value = null
  }

  function resetGame() {
    clear()
    seenOncePerGame.clear()
  }

  onUnmounted(clear)

  return { current, enqueue, clear, resetGame }
}
