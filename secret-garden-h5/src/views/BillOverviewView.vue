<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { closeToast, showLoadingToast } from 'vant'
import * as echarts from 'echarts'
import { getBillOverviewApi } from '@/services/bill-api'

const router = useRouter()

const TEXT = {
  title: '大纲详情',
  back: '返回',
  yearTab: '本年支出',
  monthTab: '本月支出',
  total: '总支出',
  categoryTitle: '类别总览',
  topTitle: '最大 10 笔花销',
  loading: '加载中...',
  noData: '暂无支出数据',
  loadFailed: '获取大纲详情失败',
}

const activeTab = ref('MONTH')
const loading = ref(false)
const errorText = ref('')
const data = ref({
  periodLabel: '',
  totalExpense: 0,
  categories: [],
  topExpenses: [],
})

const chartRef = ref(null)
let chartInstance = null

const today = new Date().toISOString().slice(0, 10)
const currentMonth = today.slice(0, 7)
const currentYear = today.slice(0, 4)

function ensureChart() {
  if (!chartRef.value) return null
  if (chartInstance && chartInstance.getDom() !== chartRef.value) {
    chartInstance.dispose()
    chartInstance = null
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }
  return chartInstance
}

function renderChart() {
  const instance = ensureChart()
  if (!instance) return

  const pieData = Array.isArray(data.value.categories)
    ? data.value.categories
        .filter((item) => Number(item?.amount) > 0)
        .map((item) => ({ name: item.category, value: Number(item.amount) }))
    : []

  if (!pieData.length) {
    instance.clear()
    instance.setOption({
      title: {
        text: TEXT.noData,
        left: 'center',
        top: 'middle',
        textStyle: {
          fontSize: 14,
          fontWeight: 'normal',
          color: '#7d8f82',
        },
      },
    })
    return
  }

  instance.setOption({
    tooltip: {
      trigger: 'item',
      triggerOn: 'click',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#445e48',
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '45%'],
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
        },
        data: pieData,
      },
    ],
  })
  instance.resize()
}

async function loadOverview() {
  if (loading.value) return

  loading.value = true
  errorText.value = ''
  showLoadingToast({
    message: TEXT.loading,
    forbidClick: true,
    duration: 0,
  })

  try {
    const params =
      activeTab.value === 'YEAR'
        ? { scope: 'YEAR', year: currentYear }
        : { scope: 'MONTH', month: currentMonth }

    const response = await getBillOverviewApi(params)
    data.value = {
      periodLabel: response?.period?.label || (activeTab.value === 'YEAR' ? currentYear : currentMonth),
      totalExpense: Number(response?.totalExpense || 0),
      categories: Array.isArray(response?.categories) ? response.categories : [],
      topExpenses: Array.isArray(response?.topExpenses) ? response.topExpenses : [],
    }
  } catch (error) {
    errorText.value = error.message || TEXT.loadFailed
    data.value = {
      periodLabel: activeTab.value === 'YEAR' ? currentYear : currentMonth,
      totalExpense: 0,
      categories: [],
      topExpenses: [],
    }
  } finally {
    loading.value = false
    closeToast()
    await nextTick()
    renderChart()
  }
}

function handleResize() {
  chartInstance?.resize()
}

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }
  router.replace({ name: 'bills' })
}

watch(
  () => activeTab.value,
  () => {
    loadOverview()
  }
)

onMounted(() => {
  loadOverview()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  closeToast()
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
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

      <van-tabs v-model:active="activeTab" line-width="24" color="#2f8041">
        <van-tab :title="TEXT.monthTab" name="MONTH" />
        <van-tab :title="TEXT.yearTab" name="YEAR" />
      </van-tabs>

      <p v-if="errorText" class="tip error">{{ errorText }}</p>

      <div class="summary-card">
        <div>
          <p class="summary-label">{{ data.periodLabel }}</p>
          <strong class="summary-value">{{ Number(data.totalExpense || 0).toFixed(2) }}</strong>
        </div>
        <span class="summary-tag">{{ TEXT.total }}</span>
      </div>

      <section class="block">
        <h3 class="block-title">{{ TEXT.categoryTitle }}</h3>
        <div class="chart-wrap">
          <div ref="chartRef" class="chart"></div>
        </div>
      </section>

      <section class="block">
        <h3 class="block-title">{{ TEXT.topTitle }}</h3>
        <van-empty v-if="!data.topExpenses.length" :description="TEXT.noData" />
        <van-cell-group v-else inset>
          <van-cell v-for="(item, idx) in data.topExpenses" :key="item.id" center>
            <template #title>
              <p class="line-1">
                <strong>{{ idx + 1 }}. {{ item.category }}</strong>
              </p>
              <p class="line-2">{{ item.billDate }} {{ item.note || '' }}</p>
            </template>

            <template #value>
              <strong class="expense-text">-{{ Number(item.amount).toFixed(2) }}</strong>
            </template>
          </van-cell>
        </van-cell-group>
      </section>
    </section>
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

.summary-card {
  margin-top: 12px;
  border-radius: 12px;
  padding: 12px;
  background: linear-gradient(120deg, #edf3ff 0%, #eaf7ef 100%);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}

.summary-label {
  margin: 0;
  font-size: 13px;
  color: #4a5f4e;
}

.summary-value {
  margin-top: 4px;
  display: block;
  font-size: 24px;
  color: #1e5130;
}

.summary-tag {
  font-size: 12px;
  color: #4d5f82;
}

.block {
  margin-top: 14px;
}

.block-title {
  margin: 0 0 8px;
  color: #213f27;
}

.chart-wrap {
  border-radius: 12px;
  background: #fff;
  border: 1px solid #edf1ee;
  padding: 8px;
}

.chart {
  width: 100%;
  height: 320px;
}

.line-1 {
  margin: 0;
}

.line-2 {
  margin: 4px 0 0;
  font-size: 13px;
  color: #5b6f5f;
  word-break: break-all;
}

.tip {
  margin: 8px 0 0;
  font-size: 14px;
}

.tip.error {
  color: #b2183f;
}

.expense-text {
  color: #b42d43;
}
</style>
