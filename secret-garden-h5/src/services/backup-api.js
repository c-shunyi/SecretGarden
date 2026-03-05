import { API_BASE_URL } from '@/services/http'
import { clearSession, sessionState } from '@/stores/session'

function parseFileName(disposition) {
  if (!disposition) return ''

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const plainMatch = disposition.match(/filename="?([^"]+)"?/i)
  return plainMatch?.[1] || ''
}

async function parseJsonSafe(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function handleUnauthorized(status) {
  if (status === 401) {
    clearSession()
  }
}

export async function exportBackupApi() {
  const headers = {}
  if (sessionState.token) {
    headers.Authorization = `Bearer ${sessionState.token}`
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/backup/export`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    handleUnauthorized(response.status)
    const payload = await parseJsonSafe(response)
    const error = new Error(payload.message || '导出失败')
    error.status = response.status
    error.code = payload.code || 'EXPORT_BACKUP_FAILED'
    throw error
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const fileName = parseFileName(disposition) || `secret-garden-backup-${Date.now()}.zip`

  return {
    blob,
    fileName,
  }
}

export async function importBackupApi(file) {
  const formData = new FormData()
  formData.append('file', file)

  const headers = {}
  if (sessionState.token) {
    headers.Authorization = `Bearer ${sessionState.token}`
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/backup/import`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const payload = await parseJsonSafe(response)
  if (!response.ok) {
    handleUnauthorized(response.status)
    const error = new Error(payload.message || '导入失败')
    error.status = response.status
    error.code = payload.code || 'IMPORT_BACKUP_FAILED'
    throw error
  }

  return payload
}

