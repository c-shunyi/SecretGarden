import { request } from './http'

export function getMyProfileApi() {
  return request('/api/v1/users/me')
}

export function updateMyProfileApi(data) {
  return request('/api/v1/users/me', {
    method: 'PATCH',
    data,
  })
}
