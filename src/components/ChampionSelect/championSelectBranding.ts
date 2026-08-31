import blueBottleLogo from '@/assets/blue_bottle-logo-color-bright_outline.svg?url'
import leagueBroadcastLogo from '@/assets/leaguebroadcast-logo_text-color-bright_outline.png'

export interface ChampionSelectPartnerLogo {
  alt: string
  source: string
}

/**
 * Default project inventory. The event identity is deliberately
 * absent: it comes from the LeagueBroadcast backend's current season.
 */
export const CHAMPION_SELECT_PARTNER_LOGOS: readonly ChampionSelectPartnerLogo[] = [
  { alt: 'BlueBottle', source: blueBottleLogo },
  { alt: 'League Broadcast', source: leagueBroadcastLogo },
]
