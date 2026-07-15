export interface PlayerNameFields {
  displayName?: string | null
  playerName?: string | null
  alias?: string | null
  name?: string | null
}

function nonEmpty(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

/**
 * Resolve the name shown on broadcast graphics. `displayName` is the backend's
 * overlay-name-aware value and must always take precedence over account names.
 */
export function playerDisplayName(player?: PlayerNameFields | null, fallback = ''): string {
  if (!player) return fallback

  const displayName = nonEmpty(player.displayName)
  if (displayName) return displayName

  const rawName = nonEmpty(player.playerName) ?? nonEmpty(player.alias) ?? nonEmpty(player.name)
  if (!rawName) return fallback

  // Riot IDs are transported as `gameName#tagLine`; graphics only show the game name.
  return rawName.split('#')[0]?.trim() || fallback
}
