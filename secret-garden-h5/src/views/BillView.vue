<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createBillApi, getBillOverviewSummaryApi, listBillsApi } from '@/services/bill-api'

const router = useRouter()

const TEXT = {
  overview: '数据大纲',
  monthExpense: '本月支出',
  todayExpense: '今日支出',
  openOverview: '查看大纲详情',
  month: '月份',
  bills: '账单列表',
  loading: '加载中...',
  noBills: '暂无账单',
  noMore: '没有更多了',
  addBill: '添加账单',
  type: '类型',
  category: '分类',
  amount: '金额',
  date: '日期',
  note: '备注',
  optional: '可选',
  saveBill: '保存账单',
  expenseTag: '支出',
  incomeTag: '收入',
  saved: '记账成功',
  saveFailed: '记账失败',
  loadFailed: '获取账单失败',
  amountError: '金额必须大于 0',
  dateError: '请选择记账日期',
}

const expenseCategories = ['餐饮', '日用', '购物', '交通', '娱乐', '住房', '零食', '水果', '医疗', '人情' , '其他']
const incomeCategories = ['工资', '奖金', '理财', '退款', '其他']

const loading = ref(false)
const loadingMore = ref(false)
const saving = ref(false)
const overviewLoading = ref(false)
const errorText = ref('')
const successText = ref('')

const month = ref(new Date().toISOString().slice(0, 7))
const list = ref([])
const overviewSummary = ref({
  monthExpense: 0,
  todayExpense: 0,
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

function selectCategory(category) {
  if (typeof category === 'string' && category) {
    form.value.category = category
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

async function loadOverviewSummary() {
  if (overviewLoading.value) return

  overviewLoading.value = true
  try {
    const response = await getBillOverviewSummaryApi()
    overviewSummary.value = {
      monthExpense: Number(response?.monthExpense || 0),
      todayExpense: Number(response?.todayExpense || 0),
    }
  } catch (error) {
    errorText.value = error.message || TEXT.loadFailed
  } finally {
    overviewLoading.value = false
  }
}

async function loadBills(reset = false) {
  if (loading.value) return
  if (!reset && !hasMore.value) return

  const page = reset ? 1 : nextPage.value
  const isFirstPage = page === 1

  if (isFirstPage) {
    loading.value = true
    loadingMore.value = false
    list.value = []
    nextPage.value = 1
    hasMore.value = true
  } else {
    if (!loadingMore.value) {
      loadingMore.value = true
    }
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
    await Promise.all([loadBills(true), loadOverviewSummary()])
  } catch (error) {
    errorText.value = error.message || TEXT.saveFailed
  } finally {
    saving.value = false
  }
}

function openBillDetail(id) {
  router.push({ name: 'bill-detail', params: { billId: id } })
}

function openOverviewDetail() {
  router.push({ name: 'bill-overview' })
}

onMounted(() => {
  Promise.all([loadBills(true), loadOverviewSummary()])
})
</script>

<template>
  <main class="page">
    <section class="panel overview-panel">
      <button type="button" class="overview-entry" @click="openOverviewDetail" :aria-label="TEXT.openOverview">
        <h2 class="panel-title">{{ TEXT.overview }}</h2>
        <van-icon name="arrow" class="overview-arrow" />
      </button>

      <div class="summary-grid" :class="{ loading: overviewLoading }">
        <div class="summary-card expense">
          <span>{{ TEXT.monthExpense }}</span>
          <strong>{{ Number(overviewSummary.monthExpense || 0).toFixed(2) }}</strong>
        </div>
        <div class="summary-card today">
          <span>{{ TEXT.todayExpense }}</span>
          <strong>{{ Number(overviewSummary.todayExpense || 0).toFixed(2) }}</strong>
        </div>
      </div>

      <p v-if="errorText" class="tip error">{{ errorText }}</p>
      <p v-if="successText" class="tip success">{{ successText }}</p>
    </section>

    <section class="panel list-panel">
      <div class="list-head">
        <h3 class="list-title">{{ TEXT.bills }}</h3>
        <label class="month-field">
          <span>{{ TEXT.month }}</span>
          <button type="button" class="month-trigger" @click="openMonthPicker">
            <span>{{ month }}</span>
            <van-icon name="arrow" class="month-arrow" />
          </button>
        </label>
      </div>

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
          <van-cell
            v-for="item in list"
            :key="item.id"
            class="bill-cell"
            center
            is-link
            @click="openBillDetail(item.id)"
          >
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
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </van-list>
    </section>

    <button type="button" class="fab-button" @click="openAddPopup" :aria-label="TEXT.addBill">
      <van-icon name="plus" class="fab-icon" />
    </button>

    <van-popup v-model:show="showAddPopup" round position="center" class="add-popup">
      <div class="add-popup-body">
        <div class="add-popup-head">
          <h3>{{ TEXT.addBill }}</h3>
          <button type="button" class="popup-close" @click="closeAddPopup">
            <van-icon name="cross" class="popup-close-icon" />
          </button>
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
                  <van-icon name="arrow" class="category-arrow" />
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

    <van-popup v-model:show="showCategoryPicker" round position="center" class="category-popup">
      <div class="category-popup-body">
        <div class="category-popup-head">
          <h4 class="category-popup-title">{{ TEXT.category }}</h4>
          <button type="button" class="popup-close" @click="closeCategoryPicker">
            <van-icon name="cross" class="popup-close-icon" />
          </button>
        </div>

        <div class="category-grid-wrap">
          <div class="category-grid">
            <button
              v-for="name in currentCategories"
              :key="`${form.billType}-${name}`"
              type="button"
              class="category-option"
              :class="{ active: form.category === name }"
              @click="selectCategory(name)"
            >
              {{ name }}
            </button>
          </div>
        </div>
      </div>
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

.overview-entry {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: inherit;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  color: #1f3f26;
}

.overview-arrow {
  color: #708873;
  font-size: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-grid.loading {
  opacity: 0.7;
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

.today {
  background: #edf3ff;
  color: #2d4e91;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.list-title {
  margin: 0;
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
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
  color: #fff;
  box-shadow: 0 12px 24px rgba(47, 128, 65, 0.35);
  z-index: 100;
}

.fab-icon {
  font-size: 28px;
  line-height: 1;
}

:deep(.add-popup) {
  width: min(92vw, 560px);
  max-height: 88vh;
  overflow-y: auto;
}

:deep(.category-popup) {
  width: min(92vw, 560px);
  max-height: 80vh;
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
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: #f0f4f1;
  color: #6a7d6d;
}

.popup-close-icon {
  font-size: 16px;
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

.category-popup-body {
  padding: 14px 12px;
  display: grid;
  gap: 12px;
}

.category-popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category-popup-title {
  margin: 0;
  color: #213f27;
  font-size: 16px;
}

.category-grid-wrap {
  max-height: min(50vh, 320px);
  overflow-y: auto;
  padding-right: 2px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.category-option {
  height: 36px;
  border: 1px solid #d0ddd3;
  border-radius: 10px;
  background: #fff;
  color: #2a4330;
  font-size: 13px;
  padding: 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-option.active {
  color: #fff;
  border-color: #2f8041;
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
  box-shadow: 0 6px 12px rgba(47, 128, 65, 0.25);
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
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
