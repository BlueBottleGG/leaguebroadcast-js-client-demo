import { createRouter, createWebHistory } from 'vue-router'
import CombinedView from '@/views/CombinedView.vue'
import OverlayView from '@/views/OverlayView.vue'
import ElementView from '@/views/ElementView.vue'
import ElementIndexView from '@/views/ElementIndexView.vue'
import { migrateLegacyHashRoute, resolveRouterBase } from './routerBase'

const routerBase = resolveRouterBase(window.location.pathname, import.meta.env.BASE_URL)
migrateLegacyHashRoute(routerBase)

const router = createRouter({
  history: createWebHistory(routerBase),
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
    // Hybrid champion select: established 2D draft layout with live 3D models
    // inside the regular bottom-row pick cards.
    {
      path: '/pregame-hybrid',
      name: 'pregame-hybrid',
      component: () => import('@/views/PregameView.vue'),
      props: { variant: 'hybrid' },
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
