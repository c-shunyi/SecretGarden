<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Secret Garden',
  },
  freeze: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['menu'])

const visible = ref(true)
let lastY = 0
let ticking = false

function updateVisibleByScroll() {
  const currentY = window.scrollY || 0

  if (props.freeze) {
    visible.value = true
    lastY = currentY
    ticking = false
    return
  }

  const delta = currentY - lastY
  if (currentY <= 0) {
    visible.value = true
  } else if (delta > 8) {
    visible.value = false
  } else if (delta < -8) {
    visible.value = true
  }

  lastY = currentY
  ticking = false
}

function onScroll() {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(updateVisibleByScroll)
}

function openMenu() {
  emit('menu')
}

watch(
  () => props.freeze,
  (freeze) => {
    if (freeze) {
      visible.value = true
    }
  }
)

onMounted(() => {
  lastY = window.scrollY || 0
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header class="app-header" :class="{ hidden: !visible }">
    <div class="inner">
      <h1 class="title">{{ title }}</h1>
      <button class="menu-btn" type="button" @click="openMenu">菜单</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 120;
  padding-top: env(safe-area-inset-top);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #d8e4da;
  transition: transform 0.22s ease;
}

.app-header.hidden {
  transform: translateY(calc(-100% - env(safe-area-inset-top)));
}

.inner {
  max-width: 980px;
  margin: 0 auto;
  height: 56px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-size: 20px;
  color: #214b28;
}

.menu-btn {
  border: 1px solid #b8d7bf;
  background: rgba(244, 255, 246, 0.95);
  color: #245b2d;
  border-radius: 10px;
  height: 36px;
  padding: 0 12px;
  font-size: 14px;
}
</style>
