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

export function getBillOverviewSummaryApi() {
  return request('/api/v1/bills/overview/summary')
}

export function getBillOverviewApi(params = {}) {
  const queryParams = new URLSearchParams()
  const scope = String(params.scope || 'MONTH').toUpperCase()

  queryParams.set('scope', scope)
  if (scope === 'YEAR' && params.year) {
    queryParams.set('year', String(params.year))
  }
  if (scope === 'MONTH' && params.month) {
    queryParams.set('month', String(params.month))
  }

  return request(`/api/v1/bills/overview?${queryParams.toString()}`)
}

export function createBillApi(data) {
  return request('/api/v1/bills', {
    method: 'POST',
    data,
  })
}

export function getBillApi(id) {
  return request(`/api/v1/bills/${id}`)
}

export function updateBillApi(id, data) {
  return request(`/api/v1/bills/${id}`, {
    method: 'PATCH',
    data,
  })
}

export function deleteBillApi(id) {
  return request(`/api/v1/bills/${id}`, {
    method: 'DELETE',
  })
}
