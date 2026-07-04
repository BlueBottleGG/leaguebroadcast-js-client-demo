import { ref, type Ref } from 'vue'

export interface PlayerNotification {
  type: 'item-buy' | 'level-up'
  /** Player index 0-4 */
  playerIndex: number
  /** 'Order' or 'Chaos' */
  team: 'Order' | 'Chaos'
  /** Item icon URL (item-buy only) */
  itemIcon?: string
  /** Item name (item-buy only) */
  itemName?: string
  /** New level (level-up only) */
  level?: number
}

const DISPLAY_DURATION = 4000

/**
 * Slot key encodes team + row: "Order-0" .. "Chaos-4" (10 slots total).
 * Each slot has its own independent queue so Order and Chaos in the same row
 * can show notifications simultaneously.
 */
type SlotKey = `${'Order' | 'Chaos'}-${number}`

function slotKey(team: 'Order' | 'Chaos', index: number): SlotKey {
  return `${team}-${index}` as SlotKey
}

/**
 * Creates a notification queue system for player events.
 * Each (team, row) pair processes one notification at a time.
 */
export function useNotificationQueue(duration: number = DISPLAY_DURATION) {
  const queues = new Map<SlotKey, PlayerNotification[]>()
  const active: Ref<Map<SlotKey, PlayerNotification>> = ref(new Map())
  const visible: Ref<Set<SlotKey>> = ref(new Set())
  const exiting: Ref<Set<SlotKey>> = ref(new Set())

  function getQueue(key: SlotKey): PlayerNotification[] {
    if (!queues.has(key)) queues.set(key, [])
    return queues.get(key)!
  }

  function enqueue(notification: PlayerNotification) {
    const key = slotKey(notification.team, notification.playerIndex)
    getQueue(key).push(notification)
    if (!active.value.has(key)) {
      processNext(key)
    }
  }

  function processNext(key: SlotKey) {
    const queue = getQueue(key)
    if (queue.length === 0) {
      active.value.delete(key)
      visible.value.delete(key)
      // Trigger reactivity
      active.value = new Map(active.value)
      visible.value = new Set(visible.value)
      return
    }

    const next = queue.shift()!
    active.value.set(key, next)
    active.value = new Map(active.value)

    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      visible.value.add(key)
      visible.value = new Set(visible.value)
    })

    // After display duration, trigger exit animation (slide out to top)
    setTimeout(() => {
      visible.value.delete(key)
      visible.value = new Set(visible.value)
      exiting.value.add(key)
      exiting.value = new Set(exiting.value)

      // Wait for exit animation, then advance queue
      setTimeout(() => {
        exiting.value.delete(key)
        exiting.value = new Set(exiting.value)
        processNext(key)
      }, 400)
    }, duration)
  }

  /** Get the active notification for a specific team + row, or null. */
  function getActive(team: 'Order' | 'Chaos', index: number): PlayerNotification | null {
    return active.value.get(slotKey(team, index)) ?? null
  }

  /** Check if the notification for a specific team + row is in its visible phase. */
  function isVisible(team: 'Order' | 'Chaos', index: number): boolean {
    return visible.value.has(slotKey(team, index))
  }

  /** Check if the notification for a specific team + row is in its exit animation phase. */
  function isExiting(team: 'Order' | 'Chaos', index: number): boolean {
    return exiting.value.has(slotKey(team, index))
  }

  return { enqueue, getActive, isVisible, isExiting }
}
