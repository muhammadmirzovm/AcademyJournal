import api from './axios'

export const getProfile       = (id)   => api.get(`/auth/users/${id}/`)
export const getUserStats     = (id)   => api.get(`/auth/users/${id}/stats/`)
export const updateMe         = (data) => api.patch('/auth/me/', data)
export const getOnlineCount   = ()     => api.get('/auth/users/online/')
export const getPlatformStats = ()     => api.get('/auth/users/platform-stats/')
