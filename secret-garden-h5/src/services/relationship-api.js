import { request } from './http'

export function getRelationshipStatusApi() {
  return request('/api/v1/relationship/status')
}

export function createInviteCodeApi() {
  return request('/api/v1/relationship/invite', {
    method: 'POST',
  })
}

export function bindRelationshipApi(code) {
  return request('/api/v1/relationship/bind', {
    method: 'POST',
    data: { code },
  })
}

export function unbindRelationshipApi() {
  return request('/api/v1/relationship/unbind', {
    method: 'POST',
    data: { confirmText: 'UNBIND' },
  })
}
