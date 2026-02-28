<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { createCheckinPlanApi, joinCheckinPlanApi, listCheckinPlansApi } from '@/services/checkin-api'

const loading = ref(false)
const creating = ref(false)
const joining = ref(false)
const tipText = ref('')
const tipType = ref('ok')

const plans = ref([])
const createForm = ref({
  name: '',
  description: '',
})
const joinCode = ref('')

function showTip(text, type = 'ok') {
  tipText.value = text
  tipType.value = type
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

async function loadPlans() {
  loading.value = true
  try {
    const response = await listCheckinPlansApi()
    plans.value = response.plans || []
  } catch (error) {
    showTip(error.message || '获取打卡计划失败', 'error')
  } finally {
    loading.value = false
  }
}

async function createPlan() {
  if (creating.value) return
  const name = createForm.value.name.trim()
  if (!name) {
    showTip('请输入计划名称', 'error')
    return
  }

  creating.value = true
  showTip('')
  try {
    await createCheckinPlanApi({
      name,
      description: createForm.value.description.trim() || null,
    })
    createForm.value.name = ''
    createForm.value.description = ''
    showTip('创建成功')
    await loadPlans()
  } catch (error) {
    showTip(error.message || '创建计划失败', 'error')
  } finally {
    creating.value = false
  }
}

async function joinPlan() {
  if (joining.value) return
  const inviteCode = joinCode.value.trim().toUpperCase()
  if (!inviteCode) {
    showTip('请输入邀请码', 'error')
    return
  }

  joining.value = true
  showTip('')
  try {
    await joinCheckinPlanApi(inviteCode)
    joinCode.value = ''
    showTip('加入成功')
    await loadPlans()
  } catch (error) {
    showTip(error.message || '加入计划失败', 'error')
  } finally {
    joining.value = false
  }
}

onMounted(() => {
  loadPlans()
})
</script>

<template>
  <main class="page">
    <section class="panel">
      <h2 class="panel-title">打卡计划</h2>

      <div class="form-grid">
        <label class="field">
          <span>新计划名称</span>
          <input v-model.trim="createForm.name" type="text" maxlength="60" placeholder="例如：早起30天" />
        </label>
        <label class="field">
          <span>计划说明（可选）</span>
          <input
            v-model.trim="createForm.description"
            type="text"
            maxlength="255"
            placeholder="例如：每天7:00前打卡"
          />
        </label>
      </div>

      <div class="actions">
        <button class="primary-btn" :disabled="creating" @click="createPlan">
          {{ creating ? '创建中...' : '创建计划' }}
        </button>
      </div>

      <div class="join-box">
        <label class="field">
          <span>邀请码加入计划</span>
          <input v-model.trim="joinCode" type="text" maxlength="20" placeholder="请输入邀请码" />
        </label>
        <button class="ghost-btn" :disabled="joining" @click="joinPlan">
          {{ joining ? '加入中...' : '加入计划' }}
        </button>
      </div>

      <p v-if="tipText" class="tip" :class="tipType === 'error' ? 'error' : 'ok'">{{ tipText }}</p>
    </section>

    <section class="panel">
      <h3 class="panel-title">我加入的计划</h3>

      <p v-if="loading" class="empty">加载中...</p>
      <p v-else-if="!plans.length" class="empty">暂无计划，先创建或加入一个吧。</p>

      <ul v-else class="plan-list">
        <li v-for="item in plans" :key="item.id" class="plan-item">
          <RouterLink class="plan-link" :to="`/checkin/${item.id}`">
            <div class="plan-main">
              <p class="line-1">
                <strong>{{ item.name }}</strong>
                <span class="role" :class="item.myRole === 'OWNER' ? 'owner' : 'member'">
                  {{ item.myRole === 'OWNER' ? '创建者' : '成员' }}
                </span>
              </p>
              <p class="line-2">{{ item.description || '无计划说明' }}</p>
              <p class="line-3">
                成员 {{ item.memberCount || 0 }} 人 · 邀请码 {{ item.inviteCode }} · 最近动态
                {{ formatTime(item.latestPostAt || item.createdAt) }}
              </p>
            </div>
            <span class="arrow">进入</span>
          </RouterLink>
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

.panel-title {
  margin: 0 0 12px;
  color: #1f3f26;
  font-size: 20px;
}

.form-grid {
  display: grid;
  gap: 10px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #3d5441;
  font-size: 14px;
}

.field input {
  width: 100%;
  height: 40px;
  border: 1px solid #d0ddd3;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  background: #fff;
  outline: none;
}

.field input:focus {
  border-color: #2f8041;
}

.actions {
  margin-top: 10px;
}

.join-box {
  margin-top: 14px;
  display: grid;
  gap: 10px;
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

.primary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.6;
}

.tip {
  margin: 12px 0 0;
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

.plan-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.plan-link {
  text-decoration: none;
  color: inherit;
  border: 1px solid #d9e8dc;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.line-1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.line-2,
.line-3 {
  margin: 6px 0 0;
  color: #516653;
  font-size: 13px;
}

.role {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.role.owner {
  background: #e9f6eb;
  color: #1f7b31;
}

.role.member {
  background: #edf3ff;
  color: #2b5ca8;
}

.arrow {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #dff3e3;
  color: #2b6735;
  display: inline-grid;
  place-items: center;
  font-size: 12px;
}
</style>
