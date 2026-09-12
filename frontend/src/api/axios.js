import axios from 'axios'

const BASE = import.meta.env?.VITE_API_URL || '/api'

const api = axios.create({ baseURL: BASE })
let refreshRequest = null

function refreshAccessToken(refresh) {
  // Share one rotation between requests that fail at the same time.
  if (!refreshRequest) {
    refreshRequest = axios.post(`${BASE}/auth/token/refresh/`, { refresh })
      .then(({ data }) => {
        // Do not restore a session that was logged out or replaced meanwhile.
        if (localStorage.getItem('refresh') !== refresh) {
          throw new Error('Session changed during token refresh')
        }
        localStorage.setItem('access', data.access)
        if (data.refresh) localStorage.setItem('refresh', data.refresh)
        return data.access
      })
      .finally(() => { refreshRequest = null })
  }
  return refreshRequest
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true
      const currentAccess = localStorage.getItem('access')
      if (currentAccess && original.headers.Authorization !== `Bearer ${currentAccess}`) {
        // Another request already completed the refresh while this 401 was in flight.
        return api(original)
      }
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const access = await refreshAccessToken(refresh)
          original.headers.Authorization = `Bearer ${access}`
          return api(original)
        } catch {
          if (localStorage.getItem('refresh') !== refresh) return Promise.reject(err)
          localStorage.removeItem('access')
          localStorage.removeItem('refresh')
          const pub = ['/', '/login', '/register', '/forgot-password']
          const isPublic = pub.includes(window.location.pathname) ||
            window.location.pathname.startsWith('/invite/')
          if (!isPublic) window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
