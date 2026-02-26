<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { hasSession } from '@/stores/session'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const drawerOpen = ref(false)

const showMenu = computed(() => hasSession() && Boolean(route.meta.showTabbar))

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
}

function closeDrawer() {
  drawerOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    closeDrawer()
  }
)
</script>

<template>
  <div class="app-shell">
    <AppHeader v-if="showMenu" title="Secret Garden" :freeze="drawerOpen" @menu="toggleDrawer" />

    <div class="page-wrap" :class="{ 'with-header': showMenu }">
      <RouterView />
    </div>

    <div v-if="showMenu && drawerOpen" class="drawer-mask" @click="closeDrawer" />

    <aside v-if="showMenu" class="drawer" :class="{ open: drawerOpen }">
      <p class="drawer-title">导航</p>
      <RouterLink to="/home" class="drawer-link" :class="{ active: route.path === '/home' }">
        主页
      </RouterLink>
      <RouterLink to="/bills" class="drawer-link" :class="{ active: route.path === '/bills' }">
        记账
      </RouterLink>
      <RouterLink to="/mine" class="drawer-link" :class="{ active: route.path === '/mine' }">
        我的
      </RouterLink>
    </aside>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
}

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 89;
  background: rgba(0, 0, 0, 0.25);
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(280px, 78vw);
  z-index: 90;
  background: #ffffff;
  box-shadow: -10px 0 24px rgba(26, 46, 29, 0.18);
  padding: calc(56px + env(safe-area-inset-top)) 14px 16px;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}

.drawer.open {
  transform: translateX(0);
}

.drawer-title {
  margin: 0 0 8px;
  padding: 0 8px;
  font-size: 13px;
  color: #7a8f7b;
}

.drawer-link {
  display: block;
  text-decoration: none;
  color: #35543b;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 15px;
}

.drawer-link.active {
  color: #1f5f2a;
  background: #e8f7e8;
  font-weight: 600;
}
</style>
