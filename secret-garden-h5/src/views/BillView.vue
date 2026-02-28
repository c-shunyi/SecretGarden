<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog } from 'vant'
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
const showCategoryPicker = ref(false)
const categoryColumns = computed(() =>
  currentCategories.value.map((name) => ({ text: name, value: name }))
)
const showMonthPicker = ref(false)
const showBillDateCalendar = ref(false)
const monthRangeStart = 2020
const monthRangeEnd = new Date().getFullYear() + 5
const monthColumns = computed(() => {
  const [yearPart, monthPart] = month.value.split('-')
  const currentYear = Number(yearPart) || new Date().getFullYear()
  const currentMonth = Number(monthPart) || new Date().getMonth() + 1

  return [
    {
      values: Array.from({ length: monthRangeEnd - monthRangeStart + 1 }, (_, idx) => {
        const year = monthRangeStart + idx
        return { text: String(year), value: String(year) }
      }),
      defaultIndex: Math.min(Math.max(currentYear - monthRangeStart, 0), monthRangeEnd - monthRangeStart),
    },
    {
      values: Array.from({ length: 12 }, (_, idx) => {
        const monthValue = String(idx + 1).padStart(2, '0')
        return { text: monthValue, value: monthValue }
      }),
      defaultIndex: Math.min(Math.max(currentMonth - 1, 0), 11),
    },
  ]
})

function resetTip() {
  errorText.value = ''
  successText.value = ''
}

function ensureCategoryInRange() {
  if (!currentCategories.value.includes(form.value.category)) {
    form.value.category = currentCategories.value[0]
  }
}

function openCategoryPicker() {
  showCategoryPicker.value = true
}

function closeCategoryPicker() {
  showCategoryPicker.value = false
}

function onCategoryConfirm(payload) {
  const next =
    payload?.selectedValues?.[0] ||
    payload?.selectedOptions?.[0]?.value ||
    payload?.selectedOptions?.[0]?.text
  if (typeof next === 'string' && next) {
    form.value.category = next
  }
  closeCategoryPicker()
}

function openMonthPicker() {
  showMonthPicker.value = true
}

function closeMonthPicker() {
  showMonthPicker.value = false
}

function openBillDateCalendar() {
  showBillDateCalendar.value = true
}

function closeBillDateCalendar() {
  showBillDateCalendar.value = false
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function onBillDateConfirm(value) {
  const selectedDate = Array.isArray(value) ? value[0] : value
  if (selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())) {
    form.value.billDate = formatDate(selectedDate)
  }
  closeBillDateCalendar()
}

async function onMonthConfirm(payload) {
  const yearValue =
    payload?.selectedValues?.[0] ||
    payload?.selectedOptions?.[0]?.value ||
    payload?.selectedOptions?.[0]?.text
  const monthValue =
    payload?.selectedValues?.[1] ||
    payload?.selectedOptions?.[1]?.value ||
    payload?.selectedOptions?.[1]?.text

  if (typeof yearValue === 'string' && typeof monthValue === 'string') {
    const normalized = `${yearValue.replace(/\D/g, '')}-${monthValue.replace(/\D/g, '').padStart(2, '0')}`
    if (/^\d{4}-\d{2}$/.test(normalized) && normalized !== month.value) {
      month.value = normalized
      await loadBills()
    }
  }

  closeMonthPicker()
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
  try {
        await showConfirmDialog({
      title: '确认',
      message: '确认删除该账单吗？',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

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

      <van-form class="form" @submit="submitBill">
        <van-cell-group inset>
          <van-field label="类型">
            <template #input>
              <van-radio-group v-model="form.billType" direction="horizontal">
                <van-radio name="EXPENSE">支出</van-radio>
                <van-radio name="INCOME">收入</van-radio>
              </van-radio-group>
            </template>
          </van-field>

          <van-field label="分类">
            <template #input>
              <div class="category-trigger" @click="openCategoryPicker">
                <span class="category-value">{{ form.category }}</span>
                <span class="category-arrow">></span>
              </div>
            </template>
          </van-field>

          <van-field
            v-model.trim="form.amount"
            type="number"
            label="金额"
            name="amount"
            placeholder="0.00"
          />

                    <van-field
            :model-value="form.billDate"
            is-link
            readonly
            label="日期"
            placeholder="请选择日期"
            @click="openBillDateCalendar"
          />

                              <van-field
            v-model.trim="form.note"
            type="text"
            label="备注"
            maxlength="255"
            placeholder="可选"
          />
        </van-cell-group>

        <van-popup v-model:show="showCategoryPicker" round position="bottom">
          <van-picker
            :columns="categoryColumns"
            @cancel="closeCategoryPicker"
            @confirm="onCategoryConfirm"
          />
                </van-popup>

        <van-calendar
          v-model:show="showBillDateCalendar"
          type="single"
          @confirm="onBillDateConfirm"
          @cancel="closeBillDateCalendar"
        />

        <div class="submit-wrap">
                    <van-button round block type="primary" native-type="submit" :loading="saving">
            记一笔
          </van-button>
        </div>
      </van-form>

      <p v-if="errorText" class="tip error">{{ errorText }}</p>
      <p v-if="successText" class="tip success">{{ successText }}</p>
    </section>

    <section class="panel">
      <div class="list-head">
        <h3>账单列表</h3>
        <label class="month-field">
          <span>月份</span>
          <button type="button" class="month-trigger" @click="openMonthPicker">
            <span>{{ month }}</span>
            <span class="month-arrow">></span>
          </button>
        </label>
      </div>

      <div v-if="loading" class="loading-wrap">
        <van-loading size="24px">加载�?..</van-loading>
      </div>
      <van-empty v-else-if="!list.length" description="暂无账单" />

      <van-cell-group v-else inset>
        <van-cell v-for="item in list" :key="item.id" class="bill-cell" center>
          <template #title>
            <p class="line-1">
              <strong>{{ item.category }}</strong>
              <van-tag :type="item.billType === 'EXPENSE' ? 'danger' : 'success'" plain>
                {{ item.billType === 'EXPENSE' ? '支出' : '收入' }}
              </van-tag>
            </p>
            <p class="line-2">{{ item.billDate }} {{ item.note || '' }}</p>
          </template>

          <template #value>
            <div class="bill-side">
              <strong :class="item.billType === 'EXPENSE' ? 'expense-text' : 'income-text'">
                {{ item.billType === 'EXPENSE' ? '-' : '+' }}{{ Number(item.amount).toFixed(2) }}
              </strong>
              <van-button
                size="mini"
                type="danger"
                plain
                :loading="deletingId === item.id"
                @click.stop="removeBill(item.id)"
              >
                删除
              </van-button>
            </div>
          </template>
        </van-cell>
      </van-cell-group>

      <van-popup v-model:show="showMonthPicker" round position="bottom">
        <van-picker :columns="monthColumns" @cancel="closeMonthPicker" @confirm="onMonthConfirm" />
              </van-popup>
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

.native-input {
  width: 100%;
  border: 1px solid #d0ddd3;
  border-radius: 8px;
  height: 32px;
  padding: 0 8px;
  font-size: 14px;
  background: #fff;
}

.category-trigger {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #d0ddd3;
  border-radius: 8px;
  padding: 0 8px;
  background: #fff;
  cursor: pointer;
}

.category-value {
  color: #1f2f1f;
}

.category-arrow {
  color: #758a79;
  font-size: 12px;
}

.submit-wrap {
  margin-top: 12px;
  padding: 0 12px;
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

.month-trigger {
  height: 32px;
  border: 1px solid #d0ddd3;
  border-radius: 8px;
  padding: 0 8px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #1f2f1f;
}

.month-arrow {
  color: #758a79;
  font-size: 12px;
}

.loading-wrap {
  padding: 20px 0;
  display: grid;
  place-items: center;
}

.bill-cell :deep(.van-cell__value) {
  flex: 0 0 auto;
}

.line-1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
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

:deep(.van-button--primary) {
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
  border-color: #2f8041;
}
</style>

