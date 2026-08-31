import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Team } from '@bluebottle_gg/league-broadcast-client'

/**
 * Shared layout state for the objective power-play stack
 * (see ObjectivePowerPlayContainer.vue).
 *
 * The baron/dragon cards hang off the scoreboard's top edge and grow downwards,
 * so anything else anchored to the top corners has to know how far down the
 * stack currently reaches — with both plays running the second card lands
 * exactly where the smite reaction card sits on the Chaos side.
 *
 * Cards claim a slot here while they are on screen rather than consumers
 * re-deriving it from `gameData`: that keeps the offset correct when the power
 * play element isn't mounted at all (individual /element/<name> routes ⇒ no
 * stack ⇒ no offset) and while a card shows its post-play completion popup,
 * which occupies the same slot without any power play being active.
 */

/** Card box height — `.power-play` / `.power-play-completion` in ObjectivePowerPlay.vue */
const CARD_HEIGHT = 64
/** Inter-card spacing — `margin-bottom` on the card itself */
const CARD_GAP = 4
/** Top inset of `.powerplay-container` */
const STACK_TOP = 10
/**
 * A slot stays claimed for the length of the card's leave transition
 * (`.pp-leave-active`: 0.25s opacity, 0.5s delay) so nothing slides underneath
 * a card that is still fading out.
 */
const SLOT_RELEASE_MS = 750

/** Slots currently on screen, keyed `${team}-${instance}`. */
const claimedSlots = ref(new Set<string>())
let nextSlotId = 0

/** Re-assign so consumers update regardless of Set mutation tracking. */
function commit() {
  claimedSlots.value = new Set(claimedSlots.value)
}

/**
 * Claims one power-play card slot for `team` while `onScreen` is true.
 * Call once per card component; the slot is dropped when its scope is disposed.
 */
export function usePowerPlaySlot(team: Team, onScreen: Ref<boolean> | ComputedRef<boolean>) {
  const key = `${team}-${nextSlotId++}`
  let releaseTimer: ReturnType<typeof setTimeout> | null = null

  function clearRelease() {
    if (releaseTimer) {
      clearTimeout(releaseTimer)
      releaseTimer = null
    }
  }

  function drop() {
    if (claimedSlots.value.delete(key)) commit()
  }

  watch(
    onScreen,
    (visible) => {
      if (visible) {
        clearRelease()
        if (!claimedSlots.value.has(key)) {
          claimedSlots.value.add(key)
          commit()
        }
        return
      }
      if (releaseTimer || !claimedSlots.value.has(key)) return
      releaseTimer = setTimeout(() => {
        releaseTimer = null
        drop()
      }, SLOT_RELEASE_MS)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearRelease()
    drop()
  })
}

/** Number of power-play cards currently on screen for `team`. */
export function usePowerPlayCardCount(team: Team): ComputedRef<number> {
  const prefix = `${team}-`
  return computed(() => {
    let count = 0
    for (const key of claimedSlots.value) {
      if (key.startsWith(prefix)) count++
    }
    return count
  })
}

/**
 * Bottom edge of `team`'s power-play stack in overlay coordinates, or 0 when the
 * stack is empty. `Math.max()` your own top against it to stay clear of the cards.
 * Includes the trailing card's `margin-bottom`, so it already carries a small gap.
 */
export function usePowerPlayStackBottom(team: Team): ComputedRef<number> {
  const cardCount = usePowerPlayCardCount(team)
  return computed(() =>
    cardCount.value === 0 ? 0 : STACK_TOP + cardCount.value * (CARD_HEIGHT + CARD_GAP),
  )
}
