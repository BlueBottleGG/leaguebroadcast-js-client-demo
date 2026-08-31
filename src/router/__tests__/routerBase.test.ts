import assert from 'node:assert/strict'
import { resolveLegacyHashRoute, resolveRouterBase } from '../routerBase.ts'

assert.equal(resolveRouterBase('/pregame', '/'), '/')
assert.equal(resolveRouterBase('/custom/my-overlay/pregame', '/'), '/custom/my-overlay')
assert.equal(
  resolveRouterBase('/custom/my-overlay/ingame/element/debug', '/'),
  '/custom/my-overlay',
)

assert.equal(resolveLegacyHashRoute('/', '', '#/pregame'), '/pregame')
assert.equal(
  resolveLegacyHashRoute('/custom/my-overlay', '?backendport=58870', '#/pregame?bg=dark'),
  '/custom/my-overlay/pregame?backendport=58870&bg=dark',
)
assert.equal(resolveLegacyHashRoute('/custom/my-overlay', '', '#section'), null)

console.log('router base and legacy hash migration passed')
