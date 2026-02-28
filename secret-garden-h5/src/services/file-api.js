import { request } from '@/services/http'

export function uploadFileApi(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request('/api/v1/files/upload', {
    method: 'POST',
    data: formData,
  })
}
