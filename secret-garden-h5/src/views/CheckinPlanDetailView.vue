<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getCheckinPlanApi, regenerateCheckinInviteApi } from '@/services/checkin-api'

const route = useRoute()
const planId = computed(() => Number(route.params.planId))

const loading = ref(false)
const regenerating = ref(false)
const tipText = ref('')
const tipType = ref('ok')
const plan = ref(null)

function showTip(text, type = 'ok') {
  tipText.value = text
  tipType.value = type
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
    showTip(error.message || '加载计划详情失败', 'error')
  } finally {
    loading.value = false
  }
}

async function regenerateInvite() {
  if (!plan.value || plan.value.myRole !== 'OWNER' || regenerating.value) return
  regenerating.value = true
  showTip('')
  try {
    const response = await regenerateCheckinInviteApi(plan.value.id)
    plan.value.inviteCode = response.inviteCode
    showTip('邀请码已更新')
  } catch (error) {
    showTip(error.message || '更新邀请码失败', 'error')
  } finally {
    regenerating.value = false
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
        <h2 class="panel-title">打卡计划详情</h2>
        <div class="head-actions">
          <RouterLink
            class="ghost-btn inline-btn"
            :to="{ name: 'checkin-plan-feed', params: { planId: planId } }"
          >
            返回动态
          </RouterLink>
          <RouterLink
            class="primary-btn inline-btn"
            :to="{ name: 'checkin-plan-punch', params: { planId: planId } }"
          >
            去打卡
          </RouterLink>
        </div>
      </div>

      <p v-if="loading" class="empty">加载中...</p>
      <template v-else-if="plan">
        <p class="line"><strong>计划名称：</strong>{{ plan.name }}</p>
        <p class="line"><strong>计划说明：</strong>{{ plan.description || '暂无说明' }}</p>
        <p class="line"><strong>成员人数：</strong>{{ plan.memberCount || 0 }} 人</p>
        <p class="line"><strong>邀请码：</strong>{{ plan.inviteCode }}</p>

        <button
          v-if="plan.myRole === 'OWNER'"
          class="ghost-btn"
          :disabled="regenerating"
          @click="regenerateInvite"
        >
          {{ regenerating ? '更新中...' : '重新生成邀请码' }}
        </button>
      </template>

      <p v-if="tipText" class="tip" :class="tipType === 'error' ? 'error' : 'ok'">{{ tipText }}</p>
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
  margin: 0 0 8px;
  color: #516653;
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
