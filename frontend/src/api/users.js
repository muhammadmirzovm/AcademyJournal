import api from './axios'

export const getProfile       = (id)   => api.get(`/auth/users/${id}/`)
export const getUserStats     = (id)   => api.get(`/auth/users/${id}/stats/`)
export const getUserChildren  = (id)   => api.get(`/auth/users/${id}/children/`)
export const getUserGroups    = (id)   => api.get(`/auth/users/${id}/groups/`)
export const changePassword   = (data) => api.post('/auth/change-password/', data)
export const getAdminStats    = ()     => api.get('/auth/admin-stats/')
export const updateMe         = (data) => api.patch('/auth/me/', data)
export const getOnlineCount   = ()     => api.get('/auth/users/online/')
export const getPlatformStats = ()     => api.get('/auth/users/platform-stats/')

export const connectTelegram        = ()     => api.post('/auth/connect-telegram/')
export const disconnectTelegram     = ()     => api.delete('/auth/connect-telegram/')
export const passwordResetRequest   = (data) => api.post('/auth/password-reset/request/', data)
export const passwordResetConfirm   = (data) => api.post('/auth/password-reset/confirm/', data)
