<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { API_BASE_URL } from '@/services/http'
import { sessionState } from '@/stores/session'
import { uploadFileApi } from '@/services/file-api'
import { createCheckinPostApi, getCheckinPlanApi } from '@/services/checkin-api'

const route = useRoute()
const planId = computed(() => Number(route.params.planId))

const loading = ref(false)
const posting = ref(false)
const uploading = ref(false)
const tipText = ref('')
const tipType = ref('ok')

const plan = ref(null)
const postForm = ref({
  content: '',
})
const selectedImages = ref([])

function showTip(text, type = 'ok') {
  tipText.value = text
  tipType.value = type
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

async function loadPlan() {
  const response = await getCheckinPlanApi(planId.value)
  plan.value = response.plan
}

async function initPage() {
  if (!Number.isInteger(planId.value) || planId.value <= 0) {
    showTip('计划ID非法', 'error')
    return
  }
  loading.value = true
  showTip('')
  try {
    await loadPlan()
  } catch (error) {
    showTip(error.message || '加载打卡页面失败', 'error')
  } finally {
    loading.value = false
  }
}

function removeSelectedImage(fileId) {
  selectedImages.value = selectedImages.value.filter((item) => item.id !== fileId)
}

async function onPickImages(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return

  if (selectedImages.value.length + files.length > 9) {
    showTip('最多只能上传9张图片', 'error')
    return
  }

  uploading.value = true
  showTip('')
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        throw new Error('仅支持上传图片文件')
      }
      const response = await uploadFileApi(file)
      const uploaded = response.file
      selectedImages.value.push({
        id: uploaded.id,
        originalName: uploaded.originalName,
        previewUrl: toAbsoluteUrl(uploaded.contentUrl),
      })
    }
  } catch (error) {
    showTip(error.message || '上传图片失败', 'error')
  } finally {
    uploading.value = false
  }
}

async function publishPost() {
  if (posting.value) return
  const content = postForm.value.content.trim()
  const imageFileIds = selectedImages.value.map((item) => item.id)
  if (!content && !imageFileIds.length) {
    showTip('请填写文字或上传图片', 'error')
    return
  }

  posting.value = true
  showTip('')
  try {
    await createCheckinPostApi(planId.value, {
      content: content || null,
      imageFileIds,
    })
    postForm.value.content = ''
    selectedImages.value = []
    showTip('打卡成功，返回动态页可查看')
  } catch (error) {
    showTip(error.message || '发布打卡失败', 'error')
  } finally {
    posting.value = false
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
        <h2 class="panel-title">打卡</h2>
        <div class="head-actions">
          <RouterLink
            class="ghost-btn inline-btn"
            :to="{ name: 'checkin-plan-feed', params: { planId: planId } }"
          >
            返回动态
          </RouterLink>
          <RouterLink
            class="ghost-btn inline-btn"
            :to="{ name: 'checkin-plan-detail', params: { planId: planId } }"
          >
            计划详情
          </RouterLink>
        </div>
      </div>

      <p v-if="loading" class="empty">加载中...</p>
      <p v-else-if="plan" class="line">当前计划：{{ plan.name }}</p>
      <p v-if="tipText" class="tip" :class="tipType === 'error' ? 'error' : 'ok'">{{ tipText }}</p>
    </section>

    <section class="panel">
      <h3 class="panel-title">发布打卡</h3>

      <label class="field">
        <span>文字内容</span>
        <textarea
          v-model.trim="postForm.content"
          rows="4"
          maxlength="2000"
          placeholder="说点今天的打卡内容..."
        />
      </label>

      <div class="upload-head">
        <span>图片（最多9张）</span>
        <label class="upload-btn">
          {{ uploading ? '上传中...' : '选择图片' }}
          <input type="file" accept="image/*" multiple :disabled="uploading" @change="onPickImages" />
        </label>
      </div>

      <div v-if="selectedImages.length" class="picked-grid">
        <div v-for="image in selectedImages" :key="image.id" class="picked-item">
          <img :src="image.previewUrl" :alt="image.originalName" />
          <button type="button" class="remove-btn" @click="removeSelectedImage(image.id)">移除</button>
        </div>
      </div>

      <div class="actions">
        <button class="primary-btn" :disabled="posting || uploading" @click="publishPost">
          {{ posting ? '发布中...' : '立即打卡' }}
        </button>
      </div>
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
  align-items: center;
  gap: 10px;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.panel-title {
  margin: 0 0 12px;
  color: #1f3f26;
  font-size: 20px;
}

.line {
  margin: 0;
  color: #516653;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #3d5441;
  font-size: 14px;
}

.field textarea {
  width: 100%;
  border: 1px solid #d0ddd3;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  background: #fff;
}

.field textarea:focus {
  border-color: #2f8041;
}

.upload-head {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #c9dfc9;
  background: #e8f6e8;
  color: #2b5632;
  font-size: 14px;
  cursor: pointer;
}

.upload-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.picked-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
}

.picked-item {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #dce8df;
}

.picked-item img {
  width: 100%;
  height: 88px;
  object-fit: cover;
  display: block;
}

.remove-btn {
  width: 100%;
  border: none;
  height: 28px;
  background: #fff0f3;
  color: #a62c41;
  font-size: 12px;
}

.actions {
  margin-top: 12px;
}

.primary-btn,
.ghost-btn {
  height: 40px;
  border: none;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
}

.primary-btn {
  color: #fff;
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
}

.ghost-btn {
  color: #2b5632;
  background: #e8f6e8;
  border: 1px solid #c9dfc9;
}

.inline-btn {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.primary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.6;
}

.tip {
  margin: 10px 0 0;
  font-size: 14px;
}

.tip.ok {
  color: #1f6a2a;
}

.tip.error {
  color: #b2183f;
}

.empty {
  margin: 0;
  color: #5d6f60;
}
</style>
