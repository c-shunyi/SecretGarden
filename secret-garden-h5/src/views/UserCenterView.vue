<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { logoutApi } from '@/services/auth-api'
import {
  bindRelationshipApi,
  createInviteCodeApi,
  getRelationshipStatusApi,
  unbindRelationshipApi,
} from '@/services/relationship-api'
import { getMyProfileApi, updateMyProfileApi } from '@/services/user-api'
import { clearSession, sessionState, setSessionUser } from '@/stores/session'

const router = useRouter()

const loadingPage = ref(true)
const profileSaving = ref(false)
const relationshipLoading = ref(false)
const inviteLoading = ref(false)
const bindLoading = ref(false)
const unbindLoading = ref(false)
const logoutLoading = ref(false)
const tipText = ref('')
const tipType = ref('success')

const profileForm = ref({
  nickname: '',
  birthday: '',
  bio: '',
  avatarFileId: '',
})

const relationship = ref({
  bound: false,
  partner: null,
})

const inviteInfo = ref({
  code: '',
  expiresAt: '',
})

const bindCode = ref('')

function showTip(text, type = 'success') {
  tipText.value = text
  tipType.value = type
}

function normalizeDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
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

async function loadRelationship() {
  relationshipLoading.value = true
  try {
    const response = await getRelationshipStatusApi()
    relationship.value = response
  } finally {
    relationshipLoading.value = false
  }
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

async function createInviteCode() {
  if (inviteLoading.value) return
  inviteLoading.value = true
  showTip('')
  try {
    const response = await createInviteCodeApi()
    inviteInfo.value = response
    showTip('邀请码已生成')
  } catch (error) {
    showTip(error.message || '生成邀请码失败', 'error')
  } finally {
    inviteLoading.value = false
  }
}

async function bindRelationship() {
  if (bindLoading.value) return
  bindLoading.value = true
  showTip('')
  try {
    const code = bindCode.value.trim().toUpperCase()
    if (!code) {
      throw new Error('请先输入邀请码')
    }
    await bindRelationshipApi(code)
    bindCode.value = ''
    inviteInfo.value = { code: '', expiresAt: '' }
    await loadProfile()
    await loadRelationship()
    showTip('绑定成功')
  } catch (error) {
    showTip(error.message || '绑定失败', 'error')
  } finally {
    bindLoading.value = false
  }
}

async function unbindRelationship() {
  if (unbindLoading.value) return
  if (!window.confirm('确认解绑吗？解绑后双方将解除关系。')) return

  unbindLoading.value = true
  showTip('')
  try {
    await unbindRelationshipApi()
    inviteInfo.value = { code: '', expiresAt: '' }
    await loadProfile()
    await loadRelationship()
    showTip('解绑成功')
  } catch (error) {
    showTip(error.message || '解绑失败', 'error')
  } finally {
    unbindLoading.value = false
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
    await Promise.all([loadProfile(), loadRelationship()])
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
      <div>
        <h1 class="title">Secret Garden</h1>
        <p class="sub">你好，{{ sessionState.user?.account || '用户' }}</p>
      </div>
      <button class="ghost-btn" :disabled="logoutLoading" @click="logout">
        {{ logoutLoading ? '退出中...' : '退出登录' }}
      </button>
    </header>

    <p v-if="tipText" class="tip" :class="tipType === 'error' ? 'error' : 'ok'">{{ tipText }}</p>

    <section v-if="loadingPage" class="panel loading-panel">正在加载数据...</section>

    <template v-else>
      <section class="panel">
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
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">关系功能</h2>
        <p class="status">
          绑定状态：
          <strong>{{ relationship.bound ? '已绑定' : '未绑定' }}</strong>
        </p>

        <p v-if="relationship.bound && relationship.partner" class="partner">
          伴侣：{{ relationship.partner.nickname || relationship.partner.account }}
          （ID: {{ relationship.partner.id }}）
        </p>

        <div class="actions">
          <button class="primary-btn" :disabled="inviteLoading || relationship.bound" @click="createInviteCode">
            {{ inviteLoading ? '生成中...' : '生成邀请码' }}
          </button>
          <button class="danger-btn" :disabled="unbindLoading || !relationship.bound" @click="unbindRelationship">
            {{ unbindLoading ? '解绑中...' : '解绑关系' }}
          </button>
        </div>

        <div v-if="inviteInfo.code" class="invite-box">
          <p>邀请码：<strong>{{ inviteInfo.code }}</strong></p>
          <p>过期时间：{{ formatDateTime(inviteInfo.expiresAt) }}</p>
        </div>

        <div class="bind-box">
          <label class="field">
            <span>输入邀请码绑定</span>
            <input v-model.trim="bindCode" type="text" maxlength="20" placeholder="请输入邀请码" />
          </label>
          <button class="primary-btn" :disabled="bindLoading || relationship.bound" @click="bindRelationship">
            {{ bindLoading ? '绑定中...' : '立即绑定' }}
          </button>
        </div>

        <p v-if="relationshipLoading" class="mini-tip">关系状态刷新中...</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  padding: 20px 16px 28px;
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

.title {
  margin: 0;
  font-size: 26px;
}

.sub {
  margin: 4px 0 0;
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
.danger-btn,
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

.danger-btn {
  color: #fff;
  background: linear-gradient(90deg, #c6424f 0%, #de5767 100%);
}

.ghost-btn {
  color: #2b5632;
  background: #e8f6e8;
  border: 1px solid #c9dfc9;
}

.primary-btn:disabled,
.danger-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.6;
}

.status,
.partner,
.mini-tip {
  margin: 0 0 10px;
  color: #435646;
}

.invite-box {
  margin: 10px 0 12px;
  border: 1px dashed #a8c8b0;
  border-radius: 10px;
  padding: 10px 12px;
  background: #f4fff4;
}

.invite-box p {
  margin: 4px 0;
}

.bind-box {
  margin-top: 6px;
}
</style>
