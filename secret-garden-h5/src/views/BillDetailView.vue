<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { deleteBillApi, getBillApi, updateBillApi } from '@/services/bill-api'

const TEXT = {
  title: '账单详情',
  back: '返回',
  loading: '加载中...',
  type: '类型',
  category: '分类',
  amount: '金额',
  date: '日期',
  note: '备注',
  optional: '可选',
  expenseTag: '支出',
  incomeTag: '收入',
  saveBill: '保存修改',
  deleteBill: '删除账单',
  confirm: '确认',
  confirmDelete: '确认删除这条账单吗？',
  cancel: '取消',
  saved: '保存成功',
  saveFailed: '保存失败',
  deleted: '删除成功',
  deleteFailed: '删除失败',
  loadFailed: '获取账单详情失败',
  invalidId: '账单 ID 非法',
  amountError: '金额必须大于 0',
  dateError: '请选择记账日期',
}

const expenseCategories = ['餐饮', '交通', '购物', '娱乐', '居家', '医疗', '其他']
const incomeCategories = ['工资', '奖金', '理财', '退款', '其他']

const route = useRoute()
const router = useRouter()
const billId = computed(() => Number(route.params.billId))

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const errorText = ref('')
const successText = ref('')
const bill = ref(null)

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

const showCategoryPicker = ref(false)
const showBillDateCalendar = ref(false)

const billDateMin = new Date(2020, 0, 1)
const billDateMax = new Date()

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

function fillFormFromBill(item) {
  form.value = {
    billType: item.billType || 'EXPENSE',
    category: item.category || expenseCategories[0],
    amount: item.amount !== null && item.amount !== undefined ? String(item.amount) : '',
    note: item.note || '',
    billDate: item.billDate || new Date().toISOString().slice(0, 10),
  }
  ensureCategoryInRange()
}

async function loadBill() {
  if (!Number.isInteger(billId.value) || billId.value <= 0) {
    errorText.value = TEXT.invalidId
    bill.value = null
    return
  }

  loading.value = true
  resetTip()
  try {
    const response = await getBillApi(billId.value)
    bill.value = response?.bill || null
    if (!bill.value) {
      throw new Error(TEXT.loadFailed)
    }
    fillFormFromBill(bill.value)
  } catch (error) {
    errorText.value = error.message || TEXT.loadFailed
    bill.value = null
  } finally {
    loading.value = false
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
  if (saving.value || loading.value || !bill.value) return

  saving.value = true
  resetTip()
  try {
    const payload = buildPayload()
    const response = await updateBillApi(billId.value, payload)
    bill.value = response?.bill || { ...bill.value, ...payload }
    fillFormFromBill(bill.value)
    successText.value = TEXT.saved
  } catch (error) {
    errorText.value = error.message || TEXT.saveFailed
  } finally {
    saving.value = false
  }
}

async function removeBill() {
  if (deleting.value || loading.value || !bill.value) return

  try {
    await showConfirmDialog({
      title: TEXT.confirm,
      message: TEXT.confirmDelete,
      confirmButtonText: TEXT.deleteBill,
      cancelButtonText: TEXT.cancel,
    })
  } catch {
    return
  }

  deleting.value = true
  resetTip()
  try {
    await deleteBillApi(billId.value)
    successText.value = TEXT.deleted
    router.replace({ name: 'bills' })
  } catch (error) {
    errorText.value = error.message || TEXT.deleteFailed
  } finally {
    deleting.value = false
  }
}

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }
  router.replace({ name: 'bills' })
}

watch(
  () => billId.value,
  () => {
    loadBill()
  }
)

onMounted(() => {
  loadBill()
})
</script>

<template>
  <main class="page">
    <section class="panel">
      <div class="head">
        <button type="button" class="back-btn" @click="goBack">
          <van-icon name="arrow-left" />
          <span>{{ TEXT.back }}</span>
        </button>
        <h2 class="panel-title">{{ TEXT.title }}</h2>
      </div>

      <div v-if="loading" class="loading-wrap">
        <van-loading size="24px">{{ TEXT.loading }}</van-loading>
      </div>

      <template v-else-if="bill">
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

          <p v-if="errorText" class="tip error">{{ errorText }}</p>
          <p v-if="successText" class="tip success">{{ successText }}</p>

          <div class="action-wrap">
            <van-button round block type="primary" native-type="submit" :loading="saving">
              {{ TEXT.saveBill }}
            </van-button>
            <van-button
              round
              block
              type="danger"
              plain
              native-type="button"
              :loading="deleting"
              @click="removeBill"
            >
              {{ TEXT.deleteBill }}
            </van-button>
          </div>
        </van-form>
      </template>

      <p v-else class="tip error">{{ errorText || TEXT.loadFailed }}</p>
    </section>

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
  margin: 0 auto;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.back-btn {
  height: 30px;
  border: 1px solid #d0ddd3;
  border-radius: 999px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  color: #36573c;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  color: #1f3f26;
}

.loading-wrap {
  padding: 20px 0;
  display: grid;
  place-items: center;
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

.tip {
  margin: 6px 0 0;
  font-size: 14px;
}

.tip.error {
  color: #b2183f;
}

.tip.success {
  color: #1f6a2a;
}

.action-wrap {
  margin-top: 8px;
  padding: 0 12px;
  display: grid;
  gap: 8px;
}

:deep(.van-button--primary) {
  background: linear-gradient(90deg, #2f8041 0%, #3d9b57 100%);
  border-color: #2f8041;
}
</style>
