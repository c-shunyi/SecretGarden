import { request } from '@/services/http'

export function listCheckinPlansApi() {
  return request('/api/v1/checkin-plans')
}

export function createCheckinPlanApi(payload) {
  return request('/api/v1/checkin-plans', {
    method: 'POST',
    data: payload,
  })
}

export function joinCheckinPlanApi(inviteCode) {
  return request('/api/v1/checkin-plans/join', {
    method: 'POST',
    data: { inviteCode },
  })
}

export function getCheckinPlanApi(planId) {
  return request(`/api/v1/checkin-plans/${planId}`)
}

export function regenerateCheckinInviteApi(planId) {
  return request(`/api/v1/checkin-plans/${planId}/invite`, {
    method: 'POST',
  })
}

export function listCheckinFeedApi(planId, options = {}) {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.beforeId) params.set('beforeId', String(options.beforeId))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return request(`/api/v1/checkin-plans/${planId}/feed${suffix}`)
}

export function createCheckinPostApi(planId, payload) {
  return request(`/api/v1/checkin-plans/${planId}/posts`, {
    method: 'POST',
    data: payload,
  })
}
