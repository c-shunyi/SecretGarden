import { request } from './http'

export function listBillsApi(month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return request(`/api/v1/bills${query}`)
}

export function createBillApi(data) {
  return request('/api/v1/bills', {
    method: 'POST',
    data,
  })
}

export function deleteBillApi(id) {
  return request(`/api/v1/bills/${id}`, {
    method: 'DELETE',
  })
}
