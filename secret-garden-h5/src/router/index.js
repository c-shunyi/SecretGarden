import { createRouter, createWebHistory } from 'vue-router'
import { hasSession } from '@/stores/session'
import AuthView from '@/views/AuthView.vue'
import HomeView from '@/views/HomeView.vue'
import BillView from '@/views/BillView.vue'
import UserCenterView from '@/views/UserCenterView.vue'
import CheckinPlansView from '@/views/CheckinPlansView.vue'
import CheckinPlanFeedView from '@/views/CheckinPlanFeedView.vue'
import CheckinPlanDetailView from '@/views/CheckinPlanDetailView.vue'
import CheckinPlanPunchView from '@/views/CheckinPlanPunchView.vue'

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
      meta: { requiresAuth: true, showTabbar: false },
    },
    {
      path: '/checkin',
      name: 'checkin-plans',
      component: CheckinPlansView,
      meta: { requiresAuth: true, showTabbar: false },
    },
    {
      path: '/checkin/:planId',
      name: 'checkin-plan-feed',
      component: CheckinPlanFeedView,
      meta: { requiresAuth: true, showTabbar: false },
    },
    {
      path: '/checkin/:planId/detail',
      name: 'checkin-plan-detail',
      component: CheckinPlanDetailView,
      meta: { requiresAuth: true, showTabbar: false },
    },
    {
      path: '/checkin/:planId/punch',
      name: 'checkin-plan-punch',
      component: CheckinPlanPunchView,
      meta: { requiresAuth: true, showTabbar: false },
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
