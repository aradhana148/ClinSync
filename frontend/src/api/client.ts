import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (Array.isArray(err.response?.data?.detail)) err.response.data.detail = err.response.data.detail.map((d: any) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join('; ')
    if (!err.response || err.response.status >= 500) window.dispatchEvent(new CustomEvent('api-error', { detail: 'Cannot reach the hospital service. Check that the backend is running, then retry.' }))
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/token')) {
      sessionStorage.removeItem('auth')
      sessionStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
