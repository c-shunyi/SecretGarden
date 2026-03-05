<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { exportBackupApi, importBackupApi } from '@/services/backup-api'
import { clearSession } from '@/stores/session'

const router = useRouter()
const exporting = ref(false)
const importing = ref(false)
const tipText = ref('')
const tipType = ref('success')
const fileInputRef = ref(null)

function showTip(text, type = 'success') {
  tipText.value = text
  tipType.value = type
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function exportAllData() {
  if (exporting.value || importing.value) return
  exporting.value = true
  showTip('')

  try {
    const { blob, fileName } = await exportBackupApi()
    downloadBlob(blob, fileName)
    showTip('导出成功，ZIP 已开始下载。')
  } catch (error) {
    showTip(error.message || '导出失败', 'error')
  } finally {
    exporting.value = false
  }
}

function triggerImport() {
  if (importing.value || exporting.value) return
  fileInputRef.value?.click()
}

async function onPickImportFile(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  event.target.value = ''

  try {
    await showConfirmDialog({
      title: '确认导入',
      message: '导入会覆盖当前数据库与上传文件，是否继续？',
      confirmButtonText: '继续导入',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  importing.value = true
  showTip('')
  try {
    await importBackupApi(file)
    showTip('导入成功，正在刷新登录状态...')
    clearSession()
    setTimeout(() => {
      router.replace('/auth')
    }, 300)
  } catch (error) {
    showTip(error.message || '导入失败', 'error')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <main class="page">
    <section class="panel">
      <h2 class="title">隐藏目录 · 数据保险箱</h2>
      <p class="desc">
        导出会把数据库数据与上传文件一起打包成 ZIP；导入可直接使用该 ZIP 一键恢复。
      </p>

      <div class="actions">
        <button class="primary-btn" :disabled="exporting || importing" @click="exportAllData">
          {{ exporting ? '导出中...' : '一键导出数据 ZIP' }}
        </button>
        <button class="ghost-btn" :disabled="importing || exporting" @click="triggerImport">
          {{ importing ? '导入中...' : '一键导入数据 ZIP' }}
        </button>
      </div>

      <input
        ref="fileInputRef"
        class="hidden-input"
        type="file"
        accept=".zip,application/zip"
        @change="onPickImportFile"
      />

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
  max-width: 780px;
  margin: 0 auto;
  border-radius: 16px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.title {
  margin: 0;
  color: #1f3f26;
  font-size: 20px;
}

.desc {
  margin: 10px 0 0;
  color: #4f6553;
  font-size: 14px;
  line-height: 1.6;
}

.actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.primary-btn,
.ghost-btn {
  height: 40px;
  border-radius: 10px;
  border: none;
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

.hidden-input {
  display: none;
}

.tip {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
}

.tip.ok {
  background: #e4f8e2;
  color: #1f6a2a;
}

.tip.error {
  background: #ffe8ec;
  color: #b2183f;
}
</style>
