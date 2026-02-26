import { createRouter, createWebHistory } from 'vue-router'
import { hasSession } from '@/stores/session'
import AuthView from '@/views/AuthView.vue'
import HomeView from '@/views/HomeView.vue'
import BillView from '@/views/BillView.vue'
import UserCenterView from '@/views/UserCenterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => (hasSession() ? '/home' : '/auth'),
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
      meta: { guestOnly: true },
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true, showTabbar: true },
    },
    {
      path: '/bills',
      name: 'bills',
      component: BillView,
      meta: { requiresAuth: true, showTabbar: true },
    },
    {
      path: '/mine',
      name: 'mine',
      component: UserCenterView,
      meta: { requiresAuth: true, showTabbar: true },
    },
    {
      path: '/center',
      redirect: '/mine',
    },
  ],
})

router.beforeEach((to) => {
  const loggedIn = hasSession()
  if (to.meta.requiresAuth && !loggedIn) {
    return { path: '/auth', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && loggedIn) {
    return { path: '/home' }
  }
  return true
})

export default router
