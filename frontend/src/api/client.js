import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 90000,
})

export const uploadDoc = async (file, options = {}, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))
  const { data } = await api.post('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: p => onProgress?.(Math.round(p.loaded * 100 / p.total)),
  })
  return data
}

export const listDocs      = ()             => api.get('/documents/').then(r => r.data)
export const getDoc        = id             => api.get(`/documents/${id}`).then(r => r.data)
export const deleteDoc     = id             => api.delete(`/documents/${id}`).then(r => r.data)
export const getExtraction = id             => api.get(`/extractions/${id}`).then(r => r.data)
export const sendChat      = (documentId, message, sessionId) =>
  api.post('/chat/', { documentId, message, sessionId }).then(r => r.data)