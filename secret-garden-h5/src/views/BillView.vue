<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { createBillApi, deleteBillApi, listBillsApi } from '@/services/bill-api'

const expenseCategories = ['餐饮', '交通', '购物', '娱乐', '居家', '医疗', '其他']
const incomeCategories = ['工资', '奖金', '理财', '退款', '其他']

const loading = ref(false)
const saving = ref(false)
const deletingId = ref(0)
const errorText = ref('')
const successText = ref('')

const month = ref(new Date().toISOString().slice(0, 7))
const list = ref([])
const summary = ref({
  expense: 0,
  income: 0,
  balance: 0,
})

const form = ref({
  billType: 'EXPENSE',
  category: expenseCategories[0],
  amount: '',
  note: '',
  billDate: new Date().toISOString().slice(0, 10),
})

const currentCategories = computed(() =>
  form.value.billType === 'EXPENSE' ? expenseCategories : incomeCategories
)

function resetTip() {
  errorText.value = ''
  successText.value = ''
}

function ensureCategoryInRange() {
  if (!currentCategories.value.includes(form.value.category)) {
    form.value.category = currentCategories.value[0]
  }
}

watch(
  () => form.value.billType,
  () => {
    ensureCategoryInRange()
  }
)

async function loadBills() {
  loading.value = true
  resetTip()
  try {
    const response = await listBillsApi(month.value)
    list.value = response.bills || []
    summary.value = response.summary || { expense: 0, income: 0, balance: 0 }
  } catch (error) {
    errorText.value = error.message || '获取账单失败'
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  const amount = Number(form.value.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金额必须大于 0')
  }
  if (!form.value.billDate) {
    throw new Error('请选择记账日期')
  }
  return {
    billType: form.value.billType,
    category: form.value.category,
    amount,
    note: form.value.note.trim() || null,
    billDate: form.value.billDate,
  }
}

async function submitBill() {
  if (saving.value) return
  saving.value = true
  resetTip()
  try {
    const payload = buildPayload()
    await createBillApi(payload)
    successText.value = '记账成功'
    form.value.amount = ''
    form.value.note = ''
    await loadBills()
  } catch (error) {
    errorText.value = error.message || '记账失败'
  } finally {
    saving.value = false
  }
}

async function removeBill(id) {
  if (deletingId.value) return
  if (!window.confirm('确认删除该账单吗？')) return
  deletingId.value = id
  resetTip()
  try {
    await deleteBillApi(id)
    successText.value = '删除成功'
    await loadBills()
  } catch (error) {
    errorText.value = error.message || '删除失败'
  } finally {
    deletingId.value = 0
  }
}

onMounted(() => {
  loadBills()
})
</script>

<template>
  <main class="page">
    <section class="panel">
      <h2 class="panel-title">简单记账</h2>

      <div class="summary-grid">
        <div class="summary-card expense">
          <span>支出</span>
          <strong>{{ summary.expense.toFixed(2) }}</strong>
        </div>
        <div class="summary-card income">
          <span>收入</span>
          <strong>{{ summary.income.toFixed(2) }}</strong>
        </div>
        <div class="summary-card balance">
          <span>结余</span>
          <strong>{{ summary.balance.toFixed(2) }}</strong>
        </div>
      </div>

      <form class="form" @submit.prevent="submitBill">
        <div class="row">
          <label class="field">
            <span>类型</span>
            <select v-model="form.billType">
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
            </select>
          </label>

          <label class="field">
            <span>分类</span>
            <select v-model="form.category">
              <option v-for="item in currentCategories" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
        </div>

        <div class="row">
          <label class="field">
            <span>金额</span>
            <input v-model.trim="form.amount" type="number" min="0.01" step="0.01" placeholder="0.00" />
          </label>
          <label class="field">
            <span>日期</span>
            <input v-model="form.billDate" type="date" />
          </label>
        </div>

        <label class="field">
          <span>备注</span>
          <input v-model.trim="form.note" type="text" maxlength="255" placeholder="可选" />
        </label>

        <button class="primary-btn" type="submit" :disabled="saving">
          {{ saving ? '提交中...' : '记一笔' }}
        </button>
      </form>

      <p v-if="errorText" class="tip error">{{ errorText }}</p>
      <p v-if="successText" class="tip success">{{ successText }}</p>
    </section>

    <section class="panel">
      <div class="list-head">
        <h3>账单列表</h3>
        <label class="month-field">
          <span>月份</span>
          <input v-model="month" type="month" @change="loadBills" />
        </label>
      </div>

      <p v-if="loading" class="empty">加载中...</p>
      <p v-else-if="!list.length" class="empty">暂无账单</p>

      <ul v-else class="bill-list">
        <li v-for="item in list" :key="item.id" class="bill-item">
          <div class="bill-main">
            <p class="line-1">
              <strong>{{ item.category }}</strong>
              <span class="type">{{ item.billType === 'EXPENSE' ? '支出' : '收入' }}</span>
            </p>
            <p class="line-2">{{ item.billDate }} {{ item.note || '' }}</p>
          </div>
          <div class="bill-side">
            <strong :class="item.billType === 'EXPENSE' ? 'expense-text' : 'income-text'">
              {{ item.billType === 'EXPENSE' ? '-' : '+' }}{{ Number(item.amount).toFixed(2) }}
            </strong>
            <button class="delete-btn" :disabled="deletingId === item.id" @click="removeBill(item.id)">
              {{ deletingId === item.id ? '删除中...' : '删除' }}
            </button>
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
  max-width: 780px;
  margin: 0 auto 12px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.panel-title {
  margin: 0 0 12px;
  font-size: 20px;
  color: #1f3f26;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.summary-card {
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 4px;
  font-size: 13px;
}

.summary-card strong {
  font-size: 18px;
}

.expense {
  background: #ffecef;
  color: #9f2138;
}

.income {
  background: #e8f8eb;
  color: #1e6a2f;
}

.balance {
  background: #edf3ff;
  color: #2d4e91;
}

.form {
  display: grid;
  gap: 10px;
}

.row {
  display: grid;
  gap: 10px;
}

@media (min-width: 680px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #435646;
  font-size: 14px;
}

.field input,
.field select {
  width: 100%;
  border: 1px solid #d0ddd3;
  border-radius: 10px;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  background: #fff;
}

.field input:focus,
.field select:focus {
  border-color: #2f8041;
}

.primary-btn {
  margin-top: 4px;
  height: 42px;
  border: none;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
  font-size: 15px;
}

.primary-btn:disabled {
  opacity: 0.6;
}

.tip {
  margin: 10px 0 0;
  font-size: 14px;
}

.tip.error {
  color: #b2183f;
}

.tip.success {
  color: #1f6a2a;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.list-head h3 {
  margin: 0;
  color: #213f27;
}

.month-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #435646;
  font-size: 13px;
}

.month-field input {
  border: 1px solid #d0ddd3;
  border-radius: 8px;
  height: 34px;
  padding: 0 10px;
  background: #fff;
}

.empty {
  margin: 0;
  color: #5c6f60;
}

.bill-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.bill-item {
  border: 1px solid #dfebe2;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.bill-main {
  min-width: 0;
}

.line-1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.type {
  font-size: 12px;
  color: #5a6f5d;
}

.line-2 {
  margin: 4px 0 0;
  font-size: 13px;
  color: #5b6f5f;
  word-break: break-all;
}

.bill-side {
  text-align: right;
  display: grid;
  justify-items: end;
  gap: 6px;
}

.income-text {
  color: #1d7c31;
}

.expense-text {
  color: #b42d43;
}

.delete-btn {
  border: 1px solid #e7cad1;
  background: #fff5f7;
  color: #a52a3f;
  border-radius: 8px;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

.delete-btn:disabled {
  opacity: 0.6;
}
</style>
