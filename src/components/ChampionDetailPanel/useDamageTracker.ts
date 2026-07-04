import { ref, type Ref } from 'vue'
import { isActive, type championDetailData } from '@bluebottle_gg/league-broadcast-client'

/** A recent HP drop, used to compute cumulative damage within the burst window. */
interface DamageSample {
  /** gameTime (seconds) at which this drop was observed */
  time: number
  /** HP lost in this sample */
  amount: number
}

/** How long a ghost segment holds at its peak before draining (ms, wall-clock). */
const GHOST_HOLD_MS = 350
/** How long the ghost segment takes to drain toward the current fill (ms, wall-clock). */
const GHOST_DRAIN_MS = 500
/** Rolling window used to detect a "big burst" of damage (seconds, gameTime). */
const BURST_WINDOW_SECONDS = 1.0
/** Cumulative damage within BURST_WINDOW_SECONDS, as a fraction of max HP, that counts as a big burst. */
const BURST_THRESHOLD_FRACTION = 0.2
/** Minimum time between big-burst panel pulses (ms, wall-clock). */
const BURST_COOLDOWN_MS = 800
/** An upward HP jump larger than this fraction of max HP is treated as a respawn/heal, not damage; resets tracker. */
const RESET_ON_HEAL_FRACTION = 0.15
/** How long the green heal segment holds at its floor before catching up to the fill (ms, wall-clock). */
const HEAL_HOLD_MS = 200
/** How long the green heal segment takes to rise toward the current fill (ms, wall-clock). */
const HEAL_RISE_MS = 500

export interface DamageTracker {
  /** Ghost segment fill percentage (0-100). Sits at the recent peak HP% and eases down toward current HP%. */
  ghostPct: Ref<number>
  /**
   * Heal segment floor percentage (0-100): the left edge of the green "heal chip".
   * The chip spans [healFloorPct, currentHp%]; it holds at the pre-heal HP then rises to meet
   * the fill. Equals the current HP% while idle, so the chip has zero width and is invisible.
   */
  healFloorPct: Ref<number>
  /** True while the panel should show the big-burst edge vignette pulse. */
  burstActive: Ref<boolean>
  /** Feed a fresh snapshot in; call reactively (e.g. from a watcher) on every update. */
  update: (detail: championDetailData | null | undefined, gameTime: number) => void
}

/**
 * Tracks recent HP loss for the champion currently shown in ChampionDetailPanel and derives:
 *  - a "ghost" fill percentage for the fighting-game-style damage-chip trailing segment
 *  - a one-shot "burst" flag for the panel-level edge vignette pulse on big hits
 *
 * The tracker is keyed to a single player at a time (whichever the panel currently shows).
 * Callers must call `update()` on every reactive change of `detail`/`gameTime`; hero switches,
 * appearances, respawns/heals, and gameTime regressions are detected internally and cause a
 * silent reset (no ghost/burst visuals fire from those transitions).
 */
export function useDamageTracker(): DamageTracker {
  const ghostPct = ref(0)
  const healFloorPct = ref(0)
  const burstActive = ref(false)

  let trackedPlayerIndex: number | null = null
  let wasVisible = false
  let prevHealth: number | null = null
  let prevMax: number | null = null
  let prevGameTime: number | null = null

  /** Recent drops within the burst window, oldest first. */
  let recentDamage: DamageSample[] = []
  /** Current animated ghost peak, as raw HP (not %), used as the drain-from value. */
  let ghostPeakHp = 0
  /** Current animated heal floor, as raw HP (not %), used as the rise-from value. */
  let healFloorHp = 0

  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let drainRaf: number | null = null
  let healHoldTimer: ReturnType<typeof setTimeout> | null = null
  let healRaf: number | null = null
  let burstCooldownUntil = 0

  /** Cancel the ghost (red damage-chip) hold/drain animation. */
  function clearGhostTimers() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    if (drainRaf !== null) {
      cancelAnimationFrame(drainRaf)
      drainRaf = null
    }
  }

  /** Cancel the heal (green heal-chip) hold/rise animation. */
  function clearHealTimers() {
    if (healHoldTimer !== null) {
      clearTimeout(healHoldTimer)
      healHoldTimer = null
    }
    if (healRaf !== null) {
      cancelAnimationFrame(healRaf)
      healRaf = null
    }
  }

  function clearTimers() {
    clearGhostTimers()
    clearHealTimers()
  }

  /** Fully reset tracker state without emitting any visual (used on switch/appear/respawn/scrub). */
  function resetTracker(health: number | null, max: number | null, gameTime: number | null) {
    clearTimers()
    recentDamage = []
    ghostPeakHp = health ?? 0
    healFloorHp = health ?? 0
    const pct = max ? Math.min(100, Math.max(0, ((health ?? 0) / max) * 100)) : 0
    ghostPct.value = pct
    healFloorPct.value = pct
    burstActive.value = false
    prevHealth = health
    prevMax = max
    prevGameTime = gameTime
  }

  function pctOf(hp: number, max: number): number {
    return max > 0 ? Math.min(100, Math.max(0, (hp / max) * 100)) : 0
  }

  /** Animate the ghost segment from its current peak down toward `targetHp` over GHOST_DRAIN_MS. */
  function drainGhostTo(targetHp: number, max: number) {
    if (drainRaf !== null) {
      cancelAnimationFrame(drainRaf)
      drainRaf = null
    }
    const startPeak = ghostPeakHp
    const startTime = performance.now()

    if (startPeak <= targetHp) {
      ghostPeakHp = targetHp
      ghostPct.value = pctOf(targetHp, max)
      return
    }

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / GHOST_DRAIN_MS)
      // ease-out (cubic)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = startPeak + (targetHp - startPeak) * eased
      ghostPeakHp = current
      ghostPct.value = pctOf(current, max)

      if (t < 1) {
        drainRaf = requestAnimationFrame(step)
      } else {
        drainRaf = null
        ghostPeakHp = targetHp
        ghostPct.value = pctOf(targetHp, max)
      }
    }
    drainRaf = requestAnimationFrame(step)
  }

  /** Schedule (or reschedule) the hold-then-drain sequence toward `targetHp`. */
  function scheduleDrain(targetHp: number, max: number) {
    if (holdTimer !== null) {
      clearTimeout(holdTimer)
    }
    holdTimer = setTimeout(() => {
      holdTimer = null
      drainGhostTo(targetHp, max)
    }, GHOST_HOLD_MS)
  }

  /** Animate the green heal segment floor from its held value up toward `targetHp` over HEAL_RISE_MS. */
  function riseHealTo(targetHp: number, max: number) {
    if (healRaf !== null) {
      cancelAnimationFrame(healRaf)
      healRaf = null
    }
    const startFloor = healFloorHp
    const startTime = performance.now()

    if (startFloor >= targetHp) {
      healFloorHp = targetHp
      healFloorPct.value = pctOf(targetHp, max)
      return
    }

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / HEAL_RISE_MS)
      // ease-out (cubic)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = startFloor + (targetHp - startFloor) * eased
      healFloorHp = current
      healFloorPct.value = pctOf(current, max)

      if (t < 1) {
        healRaf = requestAnimationFrame(step)
      } else {
        healRaf = null
        healFloorHp = targetHp
        healFloorPct.value = pctOf(targetHp, max)
      }
    }
    healRaf = requestAnimationFrame(step)
  }

  /** Schedule (or reschedule) the hold-then-rise sequence toward `targetHp`. */
  function scheduleHealRise(targetHp: number, max: number) {
    if (healHoldTimer !== null) {
      clearTimeout(healHoldTimer)
    }
    healHoldTimer = setTimeout(() => {
      healHoldTimer = null
      riseHealTo(targetHp, max)
    }, HEAL_HOLD_MS)
  }

  function update(detail: championDetailData | null | undefined, gameTime: number) {
    const visible = !!detail
    const playerIndex = detail?.playerIndex ?? null
    const health = detail?.health.current ?? null
    const max = detail?.health.max ?? null
    const isDead = isActive(detail?.respawnAt ?? undefined, gameTime)

    // --- Guards: hero switch, appear-from-hidden, gameTime regression ---
    const heroSwitched =
      trackedPlayerIndex !== null && playerIndex !== null && playerIndex !== trackedPlayerIndex
    const justAppeared = visible && !wasVisible
    const timeRegressed = prevGameTime !== null && gameTime < prevGameTime - 0.001

    if (!visible) {
      trackedPlayerIndex = null
      wasVisible = false
      resetTracker(null, null, null)
      return
    }

    if (heroSwitched || justAppeared || timeRegressed) {
      trackedPlayerIndex = playerIndex
      wasVisible = true
      resetTracker(health, max, gameTime)
      return
    }

    trackedPlayerIndex = playerIndex
    wasVisible = true

    // First sample after tracking begins (defensive; justAppeared should normally cover this).
    if (prevHealth === null || prevMax === null) {
      resetTracker(health, max, gameTime)
      return
    }

    const curHealth = health ?? 0
    const curMax = max ?? prevMax ?? 1

    // --- Guard: respawn/heal (large upward jump) resets without emitting a visual ---
    const jumpUp = curHealth - prevHealth
    if (!isDead && jumpUp > curMax * RESET_ON_HEAL_FRACTION) {
      resetTracker(curHealth, curMax, gameTime)
      return
    }

    // Death: reset silently (ghost/burst don't make sense over a death overlay).
    if (isDead) {
      resetTracker(curHealth, curMax, gameTime)
      return
    }

    const delta = prevHealth - curHealth
    if (delta > 0.0001) {
      // Damage cancels any in-progress green heal chip so the two effects never fight.
      clearHealTimers()
      healFloorHp = curHealth
      healFloorPct.value = pctOf(curHealth, curMax)

      // Record the drop for burst-window accounting.
      recentDamage.push({ time: gameTime, amount: delta })
      recentDamage = recentDamage.filter((s) => gameTime - s.time <= BURST_WINDOW_SECONDS)

      // Ghost segment: peak stays at the highest recent HP (i.e. holds at prevHealth's peak,
      // accumulating across multiple hits within the hold window) then drains toward curHealth.
      ghostPeakHp = Math.max(ghostPeakHp, prevHealth)
      ghostPct.value = pctOf(ghostPeakHp, curMax)
      scheduleDrain(curHealth, curMax)

      // Big-burst detection: cumulative damage within the window >= threshold fraction of max HP.
      const cumulative = recentDamage.reduce((sum, s) => sum + s.amount, 0)
      const now = performance.now()
      if (cumulative >= curMax * BURST_THRESHOLD_FRACTION && now >= burstCooldownUntil) {
        burstCooldownUntil = now + BURST_COOLDOWN_MS
        burstActive.value = false
        // Force a class re-trigger even if a previous pulse's transition already finished.
        requestAnimationFrame(() => {
          burstActive.value = true
          setTimeout(() => {
            burstActive.value = false
          }, 400)
        })
      }
    } else if (curHealth - prevHealth > 0.0001) {
      // HP increased but not enough to be a respawn/heal reset (e.g. sustain heal/regen).
      // Kill any red damage chip so a heal never shows red, then drive the green heal chip:
      // its floor holds at the pre-heal HP and rises to meet the fill, painting the gained
      // region green over the (possibly low-HP red) fill beneath.
      clearGhostTimers()
      ghostPeakHp = curHealth
      ghostPct.value = pctOf(curHealth, curMax)

      healFloorHp = Math.min(healFloorHp, prevHealth)
      healFloorPct.value = pctOf(healFloorHp, curMax)
      scheduleHealRise(curHealth, curMax)
    }

    prevHealth = curHealth
    prevMax = curMax
    prevGameTime = gameTime
  }

  return { ghostPct, healFloorPct, burstActive, update }
}
