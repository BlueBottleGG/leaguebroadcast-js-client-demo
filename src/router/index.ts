import { createRouter, createWebHistory } from 'vue-router'
import CombinedView from '@/views/CombinedView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Default: pregame (champ select) and ingame overlay on the same page.
    { path: '/', name: 'combined', component: CombinedView },
    // Ingame overlay only.
    {
      path: '/ingame',
      name: 'ingame',
      component: () => import('@/views/IngameView.vue'),
    },
    // Pregame / champion select scene only.
    {
      path: '/pregame',
      name: 'pregame',
      component: () => import('@/views/PregameView.vue'),
    },
  ],
})

export default router
