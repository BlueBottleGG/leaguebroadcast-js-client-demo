import { computed, type ComputedRef } from 'vue'
import type { teamMember } from '@bluebottle_gg/league-broadcast-client'
import { useIngameSelector } from '@/composables/useIngame'
import { usePlayerCameraRoster } from '@/composables/usePlayerCameraRoster'

/**
 * Drives the player-camera overlay from the champion-detail director's single global pick.
 *
 * The backend runs a rule pipeline (observer-camera framing + damage lean + death-hold, with
 * switch hysteresis) that resolves the ONE "most interesting" hero each tick and publishes it as
 * `gameData.championDetail`. Rather than re-derive any of that in the client (the dominant input —
 * each hero's on-screen framing — only exists backend-side), we reuse that pick to choose which
 * lane the cameras show.
 *
 * The picked player's slot within their team roster becomes the shared slot BOTH camera boxes lock
 * onto, so the two boxes always frame the same lane matchup: whichever team the director focused,
 * its box shows the picked player and the other box mirrors the same slot on the opposing team.
 *
 * Returns the roster index (0-based, into the per-team `teamMember[]` from
 * {@link usePlayerCameraRoster}) both cameras should show, or `null` when there is no usable pick —
 * the champion-detail overlay is hidden / not enterprise / out of game, or the picked hero can't be
 * matched to the configured roster. Callers fall back to their own rotation in that case.
 *
 * Assumes the two team rosters are configured in the same lane order (the operator's standard
 * setup), so slot L on Order lanes against slot L on Chaos. Degrades to rotation otherwise.
 *
 * Opt out with `?camdirector=0` on the overlay URL to restore pure time-based rotation.
 */

const DISABLED = new URLSearchParams(window.location.search).get('camdirector') === '0'

/** Riot id (`name#tag`) for a configured member — the same format as `championDetail.name`. */
function memberRiotId(p: teamMember): string {
  return `${p.alias}#${p.tag}`
}

export function useDirectorCameraFocus(): ComputedRef<number | null> {
  const detail = useIngameSelector((s) => s.gameData.championDetail)
  const rosters = usePlayerCameraRoster()

  return computed(() => {
    if (DISABLED) return null

    const d = detail.value
    if (!d) return null

    // The picked hero belongs to `d.team`; find its slot within that team's configured roster.
    const teamRoster = rosters.value[d.team] ?? []
    if (teamRoster.length === 0) return null

    // Match on the Riot id first (championDetail.name is `name#tag`, same as `alias#tag`); fall
    // back to the broadcast display name for rosters keyed off nicknames.
    let slot = teamRoster.findIndex((p) => memberRiotId(p) === d.name)
    if (slot < 0 && d.displayName) {
      slot = teamRoster.findIndex((p) => p.displayName === d.displayName)
    }

    return slot >= 0 ? slot : null
  })
}
