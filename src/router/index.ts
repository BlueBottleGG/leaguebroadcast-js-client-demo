import { createRouter, createWebHashHistory } from 'vue-router'
import CombinedView from '@/views/CombinedView.vue'
import OverlayView from '@/views/OverlayView.vue'
import ElementView from '@/views/ElementView.vue'
import ElementIndexView from '@/views/ElementIndexView.vue'

const router = createRouter({
  // Hash history so the overlay works under any mount path and needs no
  // server-side SPA fallback: LeagueBroadcast serves the build as static files
  // from an arbitrary subpath, so a deep-linked route like `.../pregame` would
  // 404 under history mode. With hash routing every route (`.../#/pregame`)
  // loads the same index.html, independent of the subpath it's hosted at.
  history: createWebHashHistory(),
  routes: [
    // Full broadcast (default): ingame overlay + champ select layered. One
    // source covers the whole match. `/combined` stays as an alias so existing
    // OBS sources pointed there keep working.
    {
      path: '/',
      name: 'combined',
      alias: '/combined',
      component: CombinedView,
    },
    // Ingame overlay on its own, as a standalone source.
    { path: '/ingame', name: 'ingame', component: OverlayView },
    // Pregame / champion-select scene on its own, as a standalone source.
    {
      path: '/pregame',
      name: 'pregame',
      component: () => import('@/views/PregameView.vue'),
    },
    // Opt-in 3D champion-select source. The default combined and standalone
    // pregame routes deliberately keep the established 2D presentation.
    {
      path: '/pregame-3d',
      name: 'pregame-3d',
      component: () => import('@/views/PregameView.vue'),
      props: { enable3d: true },
    },
    // Post-game recap scene on its own, as a standalone source.
    {
      path: '/postgame',
      name: 'postgame',
      component: () => import('@/views/PostgameView.vue'),
    },
    // Per-element pages + index, nested under the ingame overlay.
    { path: '/ingame/elements', name: 'elements', component: ElementIndexView },
    { path: '/ingame/element/:slug', name: 'element', component: ElementView },
    // { path: '/:pathMatch(.*)*', redirect: '/ingame/elements' },
  ],
})

export default router
