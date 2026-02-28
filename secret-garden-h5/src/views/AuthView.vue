<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginApi, registerApi } from '@/services/auth-api'
import { setSession } from '@/stores/session'

const router = useRouter()
const route = useRoute()

const mode = ref('login')
const form = ref({
  account: '',
  password: '',
})
const loading = ref(false)
const errorText = ref('')

const title = computed(() => (mode.value === 'login' ? '登录 Secret Garden' : '注册 Secret Garden'))
const buttonText = computed(() => (mode.value === 'login' ? '登录' : '注册并登录'))

function validateForm() {
  const account = form.value.account.trim()
  const password = form.value.password

  if (!/^[a-zA-Z0-9_]{4,20}$/.test(account)) {
    throw new Error('账号需为 4-20 位字母、数字或下划线')
  }
  if (password.length < 6 || password.length > 32) {
    throw new Error('密码长度需在 6-32 位')
  }

  return { account, password }
}

async function submit() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''

  try {
    const payload = validateForm()
    const response =
      mode.value === 'login' ? await loginApi(payload) : await registerApi(payload)
    setSession({
      token: response.accessToken,
      user: response.user,
    })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
    await router.replace(redirect)
  } catch (error) {
    errorText.value = error.message || '请求失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <h1 class="title">{{ title }}</h1>
      <p class="subtitle">和 Ta 一起记录生活</p>

      <van-tabs v-model:active="mode" class="mode-tabs">
        <van-tab title="登录" name="login" />
        <van-tab title="注册" name="register" />
      </van-tabs>

      <van-form class="form" @submit="submit">
        <van-cell-group inset>
          <van-field
            v-model.trim="form.account"
            name="account"
            label="账号"
            placeholder="4-20 位字母/数字/下划线"
          />
          <van-field
            v-model="form.password"
            name="password"
            type="password"
            label="密码"
            placeholder="6-32 位密码"
          />
        </van-cell-group>

        <p v-if="errorText" class="error">{{ errorText }}</p>

        <div class="submit-wrap">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            {{ buttonText }}
          </van-button>
        </div>
      </van-form>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(120% 90% at 100% 0%, #d9ffd9 0%, transparent 60%),
    radial-gradient(120% 90% at 0% 100%, #d3eef7 0%, transparent 62%),
    #f7faef;
}

.auth-panel {
  width: min(460px, 100%);
  border-radius: 24px;
  padding: 28px 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 20px 40px rgba(38, 78, 41, 0.12);
}

.title {
  margin: 0;
  font-size: 28px;
  color: #1f5125;
}

.subtitle {
  margin: 8px 0 14px;
  color: #4b6b4f;
}

.mode-tabs {
  margin-bottom: 12px;
}

.form {
  display: grid;
  gap: 12px;
}

.error {
  margin: 0;
  font-size: 13px;
  color: #b62039;
}

.submit-wrap {
  padding: 0 12px;
}

:deep(.van-tabs__line) {
  background: #2f8041;
}

:deep(.van-button--primary) {
  background: linear-gradient(90deg, #2f8041 0%, #3a9854 100%);
  border-color: #2f8041;
}
</style>
