const CUSTOM_OVERLAY_BASE = /^\/custom\/[^/]+/i

function normalizeBase(base: string): string {
  if (!base || base === '.' || base === './') return '/'
  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`
  return withLeadingSlash === '/' ? '/' : withLeadingSlash.replace(/\/$/, '')
}

export function resolveRouterBase(pathname: string, configuredBase: string): string {
  return pathname.match(CUSTOM_OVERLAY_BASE)?.[0] ?? normalizeBase(configuredBase)
}

export function resolveLegacyHashRoute(base: string, search: string, hash: string): string | null {
  if (!hash.startsWith('#/')) return null

  const [legacyPath, legacySearch = ''] = hash.slice(1).split('?', 2)
  const params = new URLSearchParams(search)
  new URLSearchParams(legacySearch).forEach((value, key) => params.set(key, value))
  const query = params.size > 0 ? `?${params.toString()}` : ''
  const prefix = normalizeBase(base) === '/' ? '' : normalizeBase(base)
  return `${prefix}${legacyPath}${query}`
}

export function migrateLegacyHashRoute(base: string): void {
  const target = resolveLegacyHashRoute(base, window.location.search, window.location.hash)
  if (target) window.history.replaceState(window.history.state, '', target)
}
