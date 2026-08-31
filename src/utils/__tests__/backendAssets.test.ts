import assert from 'node:assert/strict'
import { resolveBackendAssetUrl, resolveEventBranding } from '../backendAssets.ts'

const client = {
  getCacheUrl: (path?: string, cacheBust = false) =>
    `http://localhost:58869/cache/${path ?? ''}${cacheBust ? '?cb=test' : ''}`,
}

assert.equal(resolveBackendAssetUrl(client, undefined), null)
assert.equal(resolveBackendAssetUrl(client, '  '), null)
assert.equal(
  resolveBackendAssetUrl(client, 'season/logo.png'),
  'http://localhost:58869/cache/season/logo.png',
)
assert.equal(
  resolveBackendAssetUrl(client, 'https://cdn.example/event.svg'),
  'https://cdn.example/event.svg',
)
assert.equal(resolveBackendAssetUrl(client, '/assets/preview.png'), '/assets/preview.png')
assert.equal(
  resolveBackendAssetUrl(client, 'season/logo.png', { cacheBust: true }),
  'http://localhost:58869/cache/season/logo.png?cb=test',
)

assert.deepEqual(
  resolveEventBranding(client, {
    iconUri: 'seasons/spring-series.png',
    seasonName: '  Spring Series  ',
  }),
  {
    eventLogoUrl: 'http://localhost:58869/cache/seasons/spring-series.png?cb=test',
    eventName: 'Spring Series',
  },
)

assert.deepEqual(resolveEventBranding(client, { seasonName: '   ' }), {
  eventLogoUrl: null,
  eventName: null,
})

console.log('backend event-branding asset resolution passed')
