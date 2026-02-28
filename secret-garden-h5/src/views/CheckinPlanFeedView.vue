<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { API_BASE_URL } from '@/services/http'
import { sessionState } from '@/stores/session'
import { getCheckinPlanApi, listCheckinFeedApi } from '@/services/checkin-api'

const route = useRoute()
const planId = computed(() => Number(route.params.planId))

const loading = ref(false)
const tipText = ref('')
const plan = ref(null)
const posts = ref([])

function showTip(text) {
  tipText.value = text
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function toAbsoluteUrl(url) {
  if (!url) return ''
  const absoluteUrl = /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`
  const token = String(sessionState.token || '').trim()
  if (!token) return absoluteUrl
  if (!/\/api\/v1\/files\/\d+\/content/.test(absoluteUrl)) return absoluteUrl
  const separator = absoluteUrl.includes('?') ? '&' : '?'
  return `${absoluteUrl}${separator}access_token=${encodeURIComponent(token)}`
}

function normalizePost(post) {
  return {
    ...post,
    images: (post.images || []).map((image) => ({
      ...image,
      previewUrl: toAbsoluteUrl(image.contentUrl),
    })),
  }
}

async function initPage() {
  if (!Number.isInteger(planId.value) || planId.value <= 0) {
    showTip('计划ID非法')
    return
  }

  loading.value = true
  showTip('')
  try {
    const [planRes, feedRes] = await Promise.all([
      getCheckinPlanApi(planId.value),
      listCheckinFeedApi(planId.value, { limit: 30 }),
    ])
    plan.value = planRes.plan
    posts.value = (feedRes.posts || []).map(normalizePost)
  } catch (error) {
    showTip(error.message || '加载动态失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  initPage()
})
</script>

<template>
  <main class="page">
    <section class="panel">
      <div class="head">
        <h2 class="panel-title">{{ plan?.name || '打卡动态' }}</h2>
        <RouterLink
          v-if="plan"
          class="detail-btn"
          :to="{ name: 'checkin-plan-detail', params: { planId: plan.id } }"
        >
          查看计划详情
        </RouterLink>
      </div>

      <p v-if="tipText" class="tip error">{{ tipText }}</p>
      <p v-else class="tip">按最新时间倒序展示</p>
    </section>

    <section class="panel">
      <div class="head">
        <h3 class="panel-title">最新动态</h3>
        <RouterLink
          class="detail-btn"
          :to="{ name: 'checkin-plan-punch', params: { planId: planId } }"
        >
          去打卡
        </RouterLink>
      </div>

      <p v-if="loading" class="empty">加载中...</p>
      <p v-else-if="!posts.length" class="empty">暂无动态。</p>

      <ul v-else class="feed-list">
        <li v-for="item in posts" :key="item.id" class="feed-item">
          <div class="feed-head">
            <strong>{{ item.user.nickname || item.user.account }}</strong>
            <span>{{ formatTime(item.createdAt) }}</span>
          </div>
          <p v-if="item.content" class="feed-content">{{ item.content }}</p>
          <div v-if="item.images.length" class="image-grid">
            <a
              v-for="image in item.images"
              :key="image.id"
              :href="image.previewUrl"
              target="_blank"
              rel="noreferrer"
              class="image-box"
            >
              <img :src="image.previewUrl" :alt="image.originalName" loading="lazy" />
            </a>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  padding: 20px 16px 28px;
  background:
    radial-gradient(90% 70% at 10% 10%, rgba(194, 247, 220, 0.5), transparent 60%),
    radial-gradient(90% 70% at 90% 90%, rgba(218, 232, 255, 0.5), transparent 60%),
    #f7fbf4;
}

.panel {
  max-width: 860px;
  margin: 0 auto 12px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.panel-title {
  margin: 0;
  color: #1f3f26;
  font-size: 20px;
}

.detail-btn {
  text-decoration: none;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  background: #e8f6e8;
  border: 1px solid #c9dfc9;
  color: #2b5632;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
}

.tip {
  margin: 10px 0 0;
  color: #5d6f60;
  font-size: 13px;
}

.tip.error {
  color: #b2183f;
}

.empty {
  margin: 0;
  color: #5d6f60;
}

.feed-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.feed-item {
  border: 1px solid #d9e8dc;
  border-radius: 12px;
  padding: 12px;
}

.feed-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #415845;
  font-size: 13px;
}

.feed-content {
  margin: 8px 0 0;
  color: #213327;
  white-space: pre-wrap;
  word-break: break-word;
}

.image-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.image-box {
  display: block;
  border-radius: 8px;
  overflow: hidden;
}

.image-box img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

@media (max-width: 560px) {
  .image-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
