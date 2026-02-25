import { createRouter, createWebHistory } from 'vue-router'
import { hasSession } from '@/stores/session'
import AuthView from '@/views/AuthView.vue'
import UserCenterView from '@/views/UserCenterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => (hasSession() ? '/center' : '/auth'),
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
      meta: { guestOnly: true },
    },
    {
      path: '/center',
      name: 'center',
      component: UserCenterView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const loggedIn = hasSession()
  if (to.meta.requiresAuth && !loggedIn) {
    return { path: '/auth', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && loggedIn) {
    return { path: '/center' }
  }
  return true
})

export default router
