import { clearSession, sessionState } from '@/stores/session'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export async function request(path, options = {}) {
  const { method = 'GET', data, headers = {}, auth = true } = options

  const requestHeaders = { ...headers }
  const init = { method, headers: requestHeaders }

  if (auth && sessionState.token) {
    requestHeaders.Authorization = `Bearer ${sessionState.token}`
  }

  if (data !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
    init.body = JSON.stringify(data)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init)
  const payload = await response
    .json()
    .catch(() => ({ message: '服务返回了无法解析的数据' }))

  if (!response.ok) {
    if (response.status === 401) {
      clearSession()
    }
    const error = new Error(payload.message || '请求失败')
    error.status = response.status
    error.code = payload.code || 'REQUEST_ERROR'
    throw error
  }

  return payload
}
