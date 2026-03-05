import { request } from './http'

export function listBillsApi(params = {}) {
  let month = ''
  let page
  let pageSize

  if (typeof params === 'string') {
    month = params
  } else if (params && typeof params === 'object') {
    month = params.month || ''
    page = params.page
    pageSize = params.pageSize
  }

  const queryParams = new URLSearchParams()
  if (month) queryParams.set('month', month)
  if (page) queryParams.set('page', String(page))
  if (pageSize) queryParams.set('pageSize', String(pageSize))

  const query = queryParams.toString()
  return request(`/api/v1/bills${query ? `?${query}` : ''}`)
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
