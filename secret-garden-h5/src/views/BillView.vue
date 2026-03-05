<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { createBillApi, deleteBillApi, listBillsApi } from '@/services/bill-api'

const TEXT = {
  overview: '\u6570\u636e\u5927\u7eb2',
  month: '\u6708\u4efd',
  expense: '\u652f\u51fa',
  income: '\u6536\u5165',
  balance: '\u7ed3\u4f59',
  bills: '\u8d26\u5355\u5217\u8868',
  loading: '\u52a0\u8f7d\u4e2d...',
  noBills: '\u6682\u65e0\u8d26\u5355',
  noMore: '\u6ca1\u6709\u66f4\u591a\u4e86',
  addBill: '\u6dfb\u52a0\u8d26\u5355',
  type: '\u7c7b\u578b',
  category: '\u5206\u7c7b',
  amount: '\u91d1\u989d',
  date: '\u65e5\u671f',
  note: '\u5907\u6ce8',
  optional: '\u53ef\u9009',
  saveBill: '\u4fdd\u5b58\u8d26\u5355',
  expenseTag: '\u652f\u51fa',
  incomeTag: '\u6536\u5165',
  delete: '\u5220\u9664',
  confirm: '\u786e\u8ba4',
  confirmDelete: '\u786e\u8ba4\u5220\u9664\u8fd9\u6761\u8d26\u5355\u5417\uff1f',
  cancel: '\u53d6\u6d88',
  saved: '\u8bb0\u8d26\u6210\u529f',
  saveFailed: '\u8bb0\u8d26\u5931\u8d25',
  deleted: '\u5220\u9664\u6210\u529f',
  deleteFailed: '\u5220\u9664\u5931\u8d25',
  loadFailed: '\u83b7\u53d6\u8d26\u5355\u5931\u8d25',
  amountError: '\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0',
  dateError: '\u8bf7\u9009\u62e9\u8bb0\u8d26\u65e5\u671f',
}

const expenseCategories = [
  '\u9910\u996e',
  '\u4ea4\u901a',
  '\u8d2d\u7269',
  '\u5a31\u4e50',
  '\u5c45\u5bb6',
  '\u533b\u7597',
  '\u5176\u4ed6',
]
const incomeCategories = ['\u5de5\u8d44', '\u5956\u91d1', '\u7406\u8d22', '\u9000\u6b3e', '\u5176\u4ed6']

const loading = ref(false)
const loadingMore = ref(false)
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

const BILL_PAGE_SIZE = 10
const nextPage = ref(1)
const hasMore = ref(true)

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
const categoryColumns = computed(() =>
  currentCategories.value.map((name) => ({ text: name, value: name }))
)

const showAddPopup = ref(false)
const showCategoryPicker = ref(false)
const showMonthPicker = ref(false)
const showBillDateCalendar = ref(false)

const monthRangeStart = 2020
const monthRangeEnd = new Date().getFullYear() + 5
const billDateMin = new Date(monthRangeStart, 0, 1)
const billDateMax = new Date()

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

function resetForm() {
  form.value = {
    billType: 'EXPENSE',
    category: expenseCategories[0],
    amount: '',
    note: '',
    billDate: new Date().toISOString().slice(0, 10),
  }
}

function ensureCategoryInRange() {
  if (!currentCategories.value.includes(form.value.category)) {
    form.value.category = currentCategories.value[0]
  }
}

function openAddPopup() {
  resetTip()
  ensureCategoryInRange()
  showAddPopup.value = true
}

function closeAddPopup() {
  showAddPopup.value = false
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
  const monthValue = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${monthValue}-${day}`
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
      await loadBills(true)
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

async function loadBills(reset = false) {
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
    const response = await listBillsApi({
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
    errorText.value = error.message || TEXT.loadFailed
  } finally {
    if (isFirstPage) {
      loading.value = false
    }
    loadingMore.value = false
  }
}

function loadMoreBills() {
  return loadBills(false)
}

function buildPayload() {
  const amount = Number(form.value.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(TEXT.amountError)
  }
  if (!form.value.billDate) {
    throw new Error(TEXT.dateError)
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
    successText.value = TEXT.saved
    resetForm()
    closeAddPopup()
    await loadBills(true)
  } catch (error) {
    errorText.value = error.message || TEXT.saveFailed
  } finally {
    saving.value = false
  }
}

async function removeBill(id) {
  if (deletingId.value) return

  try {
    await showConfirmDialog({
      title: TEXT.confirm,
      message: TEXT.confirmDelete,
      confirmButtonText: TEXT.delete,
      cancelButtonText: TEXT.cancel,
    })
  } catch {
    return
  }

  deletingId.value = id
  resetTip()
  try {
    await deleteBillApi(id)
    successText.value = TEXT.deleted
    await loadBills(true)
  } catch (error) {
    errorText.value = error.message || TEXT.deleteFailed
  } finally {
    deletingId.value = 0
  }
}

onMounted(() => {
  loadBills(true)
})
</script>

<template>
  <main class="page">
    <section class="panel overview-panel">
      <div class="overview-head">
        <h2 class="panel-title">{{ TEXT.overview }}</h2>
        <label class="month-field">
          <span>{{ TEXT.month }}</span>
          <button type="button" class="month-trigger" @click="openMonthPicker">
            <span>{{ month }}</span>
            <span class="month-arrow">></span>
          </button>
        </label>
      </div>

      <div class="summary-grid">
        <div class="summary-card expense">
          <span>{{ TEXT.expense }}</span>
          <strong>{{ Number(summary.expense || 0).toFixed(2) }}</strong>
        </div>
        <div class="summary-card income">
          <span>{{ TEXT.income }}</span>
          <strong>{{ Number(summary.income || 0).toFixed(2) }}</strong>
        </div>
        <div class="summary-card balance">
          <span>{{ TEXT.balance }}</span>
          <strong>{{ Number(summary.balance || 0).toFixed(2) }}</strong>
        </div>
      </div>

      <p v-if="errorText" class="tip error">{{ errorText }}</p>
      <p v-if="successText" class="tip success">{{ successText }}</p>
    </section>

    <section class="panel list-panel">
      <h3 class="list-title">{{ TEXT.bills }}</h3>

      <div v-if="loading" class="loading-wrap">
        <van-loading size="24px">{{ TEXT.loading }}</van-loading>
      </div>
      <van-empty v-else-if="!list.length" :description="TEXT.noBills" />

      <van-list
        v-else
        v-model:loading="loadingMore"
        :finished="!hasMore"
        :finished-text="TEXT.noMore"
        @load="loadMoreBills"
      >
        <van-cell-group inset>
          <van-cell v-for="item in list" :key="item.id" class="bill-cell" center>
            <template #title>
              <p class="line-1">
                <strong>{{ item.category }}</strong>
                <van-tag :type="item.billType === 'EXPENSE' ? 'danger' : 'success'" plain>
                  {{ item.billType === 'EXPENSE' ? TEXT.expenseTag : TEXT.incomeTag }}
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
                  {{ TEXT.delete }}
                </van-button>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </van-list>
    </section>

    <button type="button" class="fab-button" @click="openAddPopup" :aria-label="TEXT.addBill">
      +
    </button>

    <van-popup v-model:show="showAddPopup" round position="center" class="add-popup">
      <div class="add-popup-body">
        <div class="add-popup-head">
          <h3>{{ TEXT.addBill }}</h3>
          <button type="button" class="popup-close" @click="closeAddPopup">?</button>
        </div>

        <van-form class="form" @submit="submitBill">
          <van-cell-group inset>
            <van-field :label="TEXT.type">
              <template #input>
                <van-radio-group v-model="form.billType" direction="horizontal">
                  <van-radio name="EXPENSE">{{ TEXT.expenseTag }}</van-radio>
                  <van-radio name="INCOME">{{ TEXT.incomeTag }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>

            <van-field :label="TEXT.category">
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
              :label="TEXT.amount"
              name="amount"
              placeholder="0.00"
            />

            <van-field
              :model-value="form.billDate"
              is-link
              readonly
              :label="TEXT.date"
              :placeholder="TEXT.date"
              @click="openBillDateCalendar"
            />

            <van-field
              v-model.trim="form.note"
              type="text"
              :label="TEXT.note"
              maxlength="255"
              :placeholder="TEXT.optional"
            />
          </van-cell-group>

          <div class="submit-wrap">
            <van-button round block type="primary" native-type="submit" :loading="saving">
              {{ TEXT.saveBill }}
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <van-popup v-model:show="showCategoryPicker" round position="bottom">
      <van-picker :columns="categoryColumns" @cancel="closeCategoryPicker" @confirm="onCategoryConfirm" />
    </van-popup>

    <van-calendar
      v-model:show="showBillDateCalendar"
      type="single"
      :min-date="billDateMin"
      :max-date="billDateMax"
      @confirm="onBillDateConfirm"
      @cancel="closeBillDateCalendar"
    />

    <van-popup v-model:show="showMonthPicker" round position="bottom">
      <van-picker :columns="monthColumns" @cancel="closeMonthPicker" @confirm="onMonthConfirm" />
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
