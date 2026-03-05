<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { show确认Dialog } from 'vant'
import { createBillApi, deleteBillApi, list账单列表Api } from '@/services/bill-api'

const expenseCategories = ['餐饮', '交通', '购物', '娱乐', '居家', '医疗', 'Other']
const incomeCategories = ['工资', '奖金', '理财', '退款', 'Other']

const loading = ref(false)
const loadingMore = ref(false)
const saving = ref(false)
const deletingId = ref(0)
const errorText = ref('')
const successText = ref('')

const month = ref(new 日期().toISOString().slice(0, 7))
const list = ref([])
const summary = ref({
  expense: 0,
  income: 0,
  balance: 0,
})

const BILL_PAGE_SIZE = 10
const nextPage = ref(1)
const hasMore = ref(true)

const form = ref({
  bill类型: 'EXPENSE',
  category: expenseCategories[0],
  amount: '',
  note: '',
  bill日期: new 日期().toISOString().slice(0, 10),
})

const currentCategories = computed(() =>
  form.value.bill类型 === 'EXPENSE' ? expenseCategories : incomeCategories
)
const categoryColumns = computed(() =>
  currentCategories.value.map((name) => ({ text: name, value: name }))
)

const showAddPopup = ref(false)
const show分类Picker = ref(false)
const show月份Picker = ref(false)
const showBill日期Calendar = ref(false)

const monthRangeStart = 2020
const monthRangeEnd = new 日期().getFullYear() + 5
const bill日期Min = new 日期(monthRangeStart, 0, 1)
const bill日期Max = new 日期()

const monthColumns = computed(() => {
  const [yearPart, monthPart] = month.value.split('-')
  const currentYear = Number(yearPart) || new 日期().getFullYear()
  const current月份 = Number(monthPart) || new 日期().get月份() + 1

  return [
    {
      values: Array.from({ length: monthRangeEnd - monthRangeStart + 1 }, (_, idx) => {
        const year = monthRangeStart + idx
        return { text: String(year), value: String(year) }
      }),
      defaultIndex: Math.min(
        Math.max(currentYear - monthRangeStart, 0),
        monthRangeEnd - monthRangeStart
      ),
    },
    {
      values: Array.from({ length: 12 }, (_, idx) => {
        const monthValue = String(idx + 1).padStart(2, '0')
        return { text: monthValue, value: monthValue }
      }),
      defaultIndex: Math.min(Math.max(current月份 - 1, 0), 11),
    },
  ]
})

function resetTip() {
  errorText.value = ''
  successText.value = ''
}

function resetForm() {
  form.value = {
    bill类型: 'EXPENSE',
    category: expenseCategories[0],
    amount: '',
    note: '',
    bill日期: new 日期().toISOString().slice(0, 10),
  }
}

function ensure分类InRange() {
  if (!currentCategories.value.includes(form.value.category)) {
    form.value.category = currentCategories.value[0]
  }
}

function openAddPopup() {
  resetTip()
  ensure分类InRange()
  showAddPopup.value = true
}

function closeAddPopup() {
  showAddPopup.value = false
}

function open分类Picker() {
  show分类Picker.value = true
}

function close分类Picker() {
  show分类Picker.value = false
}

function on分类确认(payload) {
  const next =
    payload?.selectedValues?.[0] ||
    payload?.selectedOptions?.[0]?.value ||
    payload?.selectedOptions?.[0]?.text
  if (typeof next === 'string' && next) {
    form.value.category = next
  }
  close分类Picker()
}

function open月份Picker() {
  show月份Picker.value = true
}

function close月份Picker() {
  show月份Picker.value = false
}

function openBill日期Calendar() {
  showBill日期Calendar.value = true
}

function closeBill日期Calendar() {
  showBill日期Calendar.value = false
}

function format日期(date) {
  const year = date.getFullYear()
  const monthValue = String(date.get月份() + 1).padStart(2, '0')
  const day = String(date.get日期()).padStart(2, '0')
  return `${year}-${monthValue}-${day}`
}

function onBill日期确认(value) {
  const selected日期 = Array.isArray(value) ? value[0] : value
  if (selected日期 instanceof 日期 && !Number.isNaN(selected日期.getTime())) {
    form.value.bill日期 = format日期(selected日期)
  }
  closeBill日期Calendar()
}

async function on月份确认(payload) {
  const yearValue =
    payload?.selectedValues?.[0] ||
    payload?.selectedOptions?.[0]?.value ||
    payload?.selectedOptions?.[0]?.text
  const monthValue =
    payload?.selectedValues?.[1] ||
    payload?.selectedOptions?.[1]?.value ||
    payload?.selectedOptions?.[1]?.text

  if (typeof yearValue === 'string' && typeof monthValue === 'string') {
    const normalized = `${yearValue.replace(/\D/g, '')}-${monthValue
      .replace(/\D/g, '')
      .padStart(2, '0')}`
    if (/^\d{4}-\d{2}$/.test(normalized) && normalized !== month.value) {
      month.value = normalized
      await load账单列表(true)
    }
  }

  close月份Picker()
}

watch(
  () => form.value.bill类型,
  () => {
    ensure分类InRange()
  }
)

async function load账单列表(reset = false) {
  if (loading.value || loadingMore.value) return
  if (!reset && !hasMore.value) return

  const page = reset ? 1 : nextPage.value
  const isFirstPage = page === 1

  if (isFirstPage) {
    loading.value = true
    list.value = []
    nextPage.value = 1
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  if (reset) {
    resetTip()
  }

  try {
    const response = await list账单列表Api({
      month: month.value,
      page,
      pageSize: BILL_PAGE_SIZE,
    })

    const rows = Array.isArray(response?.bills) ? response.bills : []
    list.value = isFirstPage ? rows : [...list.value, ...rows]
    summary.value = response?.summary || { expense: 0, income: 0, balance: 0 }

    const serverHasMore = response?.pagination?.hasMore
    hasMore.value =
      typeof serverHasMore === 'boolean' ? serverHasMore : rows.length >= BILL_PAGE_SIZE
    nextPage.value = page + 1
  } catch (error) {
    errorText.value = error.message || '获取账单失败'
  } finally {
    if (isFirstPage) {
      loading.value = false
    }
    loadingMore.value = false
  }
}

function loadMore账单列表() {
  return load账单列表(false)
}

function buildPayload() {
  const amount = Number(form.value.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金额必须大于 0')
  }
  if (!form.value.bill日期) {
    throw new Error('请选择记账日期')
  }

  return {
    bill类型: form.value.bill类型,
    category: form.value.category,
    amount,
    note: form.value.note.trim() || null,
    bill日期: form.value.bill日期,
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
    resetForm()
    closeAddPopup()
    await load账单列表(true)
  } catch (error) {
    errorText.value = error.message || '记账失败'
  } finally {
    saving.value = false
  }
}

async function removeBill(id) {
  if (deletingId.value) return

  try {
    await show确认Dialog({
      title: '确认',
      message: '确认删除这条账单吗？',
      confirmButtonText: '删除',
      cancelButtonText: 'Cancel',
    })
  } catch {
    return
  }

  deletingId.value = id
  resetTip()
  try {
    await deleteBillApi(id)
    successText.value = '删除d'
    await load账单列表(true)
  } catch (error) {
    errorText.value = error.message || '删除失败'
  } finally {
    deletingId.value = 0
  }
}

onMounted(() => {
  load账单列表(true)
})
</script>

<template>
  <main class="page">
    <section class="panel overview-panel">
      <div class="overview-head">
        <h2 class="panel-title">数据大纲</h2>
        <label class="month-field">
          <span>月份</span>
          <button type="button" class="month-trigger" @click="open月份Picker">
            <span>{{ month }}</span>
            <span class="month-arrow">></span>
          </button>
        </label>
      </div>

      <div class="summary-grid">
        <div class="summary-card expense">
          <span>支出</span>
          <strong>{{ Number(summary.expense || 0).toFixed(2) }}</strong>
        </div>
        <div class="summary-card income">
          <span>收入</span>
          <strong>{{ Number(summary.income || 0).toFixed(2) }}</strong>
        </div>
        <div class="summary-card balance">
          <span>结余</span>
          <strong>{{ Number(summary.balance || 0).toFixed(2) }}</strong>
        </div>
      </div>

      <p v-if="errorText" class="tip error">{{ errorText }}</p>
      <p v-if="successText" class="tip success">{{ successText }}</p>
    </section>

    <section class="panel list-panel">
      <h3 class="list-title">账单列表</h3>

      <div v-if="loading" class="loading-wrap">
        <van-loading size="24px">加载中...</van-loading>
      </div>
      <van-empty v-else-if="!list.length" description="暂无账单" />

      <van-list
        v-else
        v-model:loading="loadingMore"
        :finished="!hasMore"
        finished-text="没有更多了"
        @load="loadMore账单列表"
      >
        <van-cell-group inset>
          <van-cell v-for="item in list" :key="item.id" class="bill-cell" center>
            <template #title>
              <p class="line-1">
                <strong>{{ item.category }}</strong>
                <van-tag :type="item.bill类型 === 'EXPENSE' ? 'danger' : 'success'" plain>
                  {{ item.bill类型 === 'EXPENSE' ? '支出' : '收入' }}
                </van-tag>
              </p>
              <p class="line-2">{{ item.bill日期 }} {{ item.note || '' }}</p>
            </template>

            <template #value>
              <div class="bill-side">
                <strong :class="item.bill类型 === 'EXPENSE' ? 'expense-text' : 'income-text'">
                  {{ item.bill类型 === 'EXPENSE' ? '-' : '+' }}{{ Number(item.amount).toFixed(2) }}
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
      </van-list>
    </section>

    <button type="button" class="fab-button" @click="openAddPopup" aria-label="添加账单">
      +
    </button>

    <van-popup v-model:show="showAddPopup" round position="center" class="add-popup">
      <div class="add-popup-body">
        <div class="add-popup-head">
          <h3>添加账单</h3>
          <button type="button" class="popup-close" @click="closeAddPopup">×</button>
        </div>

        <van-form class="form" @submit="submitBill">
          <van-cell-group inset>
            <van-field label="类型">
              <template #input>
                <van-radio-group v-model="form.bill类型" direction="horizontal">
                  <van-radio name="EXPENSE">支出</van-radio>
                  <van-radio name="INCOME">收入</van-radio>
                </van-radio-group>
              </template>
            </van-field>

            <van-field label="分类">
              <template #input>
                <div class="category-trigger" @click="open分类Picker">
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
              :model-value="form.bill日期"
              is-link
              readonly
              label="日期"
              placeholder="Select date"
              @click="openBill日期Calendar"
            />

            <van-field
              v-model.trim="form.note"
              type="text"
              label="备注"
              maxlength="255"
              placeholder="可选"
            />
          </van-cell-group>

          <div class="submit-wrap">
            <van-button round block type="primary" native-type="submit" :loading="saving">
              保存账单
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <van-popup v-model:show="show分类Picker" round position="bottom">
      <van-picker :columns="categoryColumns" @cancel="close分类Picker" @confirm="on分类确认" />
    </van-popup>

    <van-calendar
      v-model:show="showBill日期Calendar"
      type="single"
      :min-date="bill日期Min"
      :max-date="bill日期Max"
      @confirm="onBill日期确认"
      @cancel="closeBill日期Calendar"
    />

    <van-popup v-model:show="show月份Picker" round position="bottom">
      <van-picker :columns="monthColumns" @cancel="close月份Picker" @confirm="on月份确认" />
    </van-popup>
  </main>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  padding: 16px 14px 28px;
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
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  color: #1f3f26;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
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

.list-title {
  margin: 0 0 10px;
  color: #213f27;
}

.loading-wrap {
  padding: 20px 0;
  display: grid;
  place-items: center;
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

.fab-button {
  position: fixed;
  right: 20px;
  bottom: 90px;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
  color: #fff;
  font-size: 34px;
  line-height: 1;
  box-shadow: 0 12px 24px rgba(47, 128, 65, 0.35);
  z-index: 100;
}

:deep(.add-popup) {
  width: min(92vw, 560px);
  max-height: 88vh;
  overflow-y: auto;
}

.add-popup-body {
  padding: 14px 12px 16px;
}

.add-popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.add-popup-head h3 {
  margin: 0;
  color: #213f27;
}

.popup-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #f0f4f1;
  color: #6a7d6d;
  font-size: 20px;
}

.form {
  display: grid;
  gap: 10px;
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
  margin-top: 8px;
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
