<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { logoutApi } from '@/services/auth-api'
import { getMyProfileApi, updateMyProfileApi } from '@/services/user-api'
import { clearSession, sessionState, setSessionUser } from '@/stores/session'

const router = useRouter()

const loadingPage = ref(true)
const profileSaving = ref(false)
const logoutLoading = ref(false)
const tipText = ref('')
const tipType = ref('success')

const profileForm = ref({
  nickname: '',
  birthday: '',
  bio: '',
  avatarFileId: '',
})

function showTip(text, type = 'success') {
  tipText.value = text
  tipType.value = type
}

function normalizeDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function syncProfileForm(user) {
  profileForm.value.nickname = user?.nickname || ''
  profileForm.value.birthday = normalizeDate(user?.birthday)
  profileForm.value.bio = user?.bio || ''
  profileForm.value.avatarFileId = user?.avatarFileId ? String(user.avatarFileId) : ''
}

async function loadProfile() {
  const response = await getMyProfileApi()
  setSessionUser(response.user)
  syncProfileForm(response.user)
}

function buildProfilePayload() {
  const avatarRaw = profileForm.value.avatarFileId.trim()
  const payload = {
    nickname: profileForm.value.nickname.trim() || null,
    birthday: profileForm.value.birthday || null,
    bio: profileForm.value.bio.trim() || null,
    avatarFileId: null,
  }

  if (avatarRaw) {
    const avatarNumber = Number(avatarRaw)
    if (!Number.isInteger(avatarNumber) || avatarNumber <= 0) {
      throw new Error('头像文件ID必须是正整数')
    }
    payload.avatarFileId = avatarNumber
  }

  return payload
}

async function saveProfile() {
  if (profileSaving.value) return
  profileSaving.value = true
  showTip('')

  try {
    const payload = buildProfilePayload()
    const response = await updateMyProfileApi(payload)
    setSessionUser(response.user)
    syncProfileForm(response.user)
    showTip('资料已保存')
  } catch (error) {
    showTip(error.message || '保存失败', 'error')
  } finally {
    profileSaving.value = false
  }
}

async function logout() {
  if (logoutLoading.value) return
  logoutLoading.value = true

  try {
    await logoutApi()
  } catch {
  } finally {
    clearSession()
    await router.replace('/auth')
    logoutLoading.value = false
  }
}

onMounted(async () => {
  loadingPage.value = true
  showTip('')

  try {
    await loadProfile()
  } catch (error) {
    showTip(error.message || '初始化失败，请重新登录', 'error')
    if ((error.status || 0) === 401) {
      clearSession()
      await router.replace('/auth')
    }
  } finally {
    loadingPage.value = false
  }
})
</script>

<template>
  <main class="page">
    <header class="header">
      <p class="sub">你好，{{ sessionState.user?.account || '用户' }}</p>
    </header>

    <p v-if="tipText" class="tip" :class="tipType === 'error' ? 'error' : 'ok'">{{ tipText }}</p>

    <section v-if="loadingPage" class="panel loading-panel">正在加载数据...</section>

    <section v-else class="panel">
      <h2 class="panel-title">个人资料</h2>

      <div class="grid">
        <label class="field">
          <span>昵称</span>
          <input v-model.trim="profileForm.nickname" type="text" maxlength="30" />
        </label>

        <label class="field">
          <span>生日</span>
          <input v-model="profileForm.birthday" type="date" />
        </label>
      </div>

      <label class="field">
        <span>头像文件ID</span>
        <input
          v-model.trim="profileForm.avatarFileId"
          type="text"
          inputmode="numeric"
          placeholder="后端文件上传后返回的文件ID"
        />
      </label>

      <label class="field">
        <span>个人简介</span>
        <textarea v-model.trim="profileForm.bio" rows="4" maxlength="500" />
      </label>

      <div class="actions">
        <button class="primary-btn" :disabled="profileSaving" @click="saveProfile">
          {{ profileSaving ? '保存中...' : '保存资料' }}
        </button>
        <button class="ghost-btn" :disabled="logoutLoading" @click="logout">
          {{ logoutLoading ? '退出中...' : '退出登录' }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  padding: 70px 16px 28px;
  background:
    radial-gradient(95% 70% at 0% 0%, rgba(194, 247, 220, 0.5), transparent 60%),
    radial-gradient(95% 70% at 100% 100%, rgba(218, 232, 255, 0.5), transparent 60%),
    #f7fbf4;
  color: #1f2a22;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 0 auto 12px;
  max-width: 780px;
}

.sub {
  margin: 0;
  color: #496147;
  font-size: 14px;
}

.tip {
  max-width: 780px;
  margin: 0 auto 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
}

.tip.ok {
  background: #e4f8e2;
  color: #1f6a2a;
}

.tip.error {
  background: #ffe8ec;
  color: #b2183f;
}

.panel {
  max-width: 780px;
  margin: 0 auto 12px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.loading-panel {
  text-align: center;
  color: #4d6150;
}

.panel-title {
  margin: 0 0 12px;
  font-size: 18px;
}

.grid {
  display: grid;
  gap: 12px;
}

@media (min-width: 680px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.field span {
  color: #405244;
  font-size: 14px;
}

.field input,
.field textarea {
  width: 100%;
  border: 1px solid #d0ddd3;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  background: #fff;
}

.field input:focus,
.field textarea:focus {
  border-color: #2f8041;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.primary-btn,
.ghost-btn {
  height: 40px;
  border-radius: 10px;
  border: none;
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

.primary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.6;
}
</style>
