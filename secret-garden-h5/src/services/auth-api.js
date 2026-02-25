import { request } from './http'

export function registerApi(data) {
  return request('/api/v1/auth/register', {
    method: 'POST',
    data,
    auth: false,
  })
}

export function loginApi(data) {
  return request('/api/v1/auth/login', {
    method: 'POST',
    data,
    auth: false,
  })
}

export function logoutApi() {
  return request('/api/v1/auth/logout', {
    method: 'POST',
  })
}
