import type { LeagueBroadcastClient, seasonData } from '@bluebottle_gg/league-broadcast-client'

const ABSOLUTE_ASSET_URL = /^(?:https?:|data:|blob:)/i

export interface BackendAssetUrlOptions {
  cacheBust?: boolean
}

/** Resolve a backend cache path while preserving absolute and Vite asset URLs. */
export function resolveBackendAssetUrl(
  client: Pick<LeagueBroadcastClient, 'getCacheUrl'>,
  path?: string | null,
  options: BackendAssetUrlOptions = {},
): string | null {
  const value = path?.trim()
  if (!value) return null
  if (ABSOLUTE_ASSET_URL.test(value) || value.startsWith('/src/') || value.startsWith('/assets/')) {
    return value
  }
  return client.getCacheUrl(value, options.cacheBust)
}

export interface ResolvedEventBranding {
  eventLogoUrl: string | null
  eventName: string | null
}

export function resolveEventBranding(
  client: Pick<LeagueBroadcastClient, 'getCacheUrl'>,
  season: Pick<seasonData, 'iconUri' | 'seasonName'>,
): ResolvedEventBranding {
  return {
    // LeagueBroadcast replaces the event icon at a stable cache path. A unique
    // URL per branding reload prevents a cached 404/non-CORS response from
    // permanently forcing the name fallback in CanvasTexture/WebGL consumers.
    eventLogoUrl: resolveBackendAssetUrl(client, season.iconUri, { cacheBust: true }),
    eventName: season.seasonName?.trim() || null,
  }
}
