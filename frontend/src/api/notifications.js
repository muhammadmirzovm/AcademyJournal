import api from './axios'

export const getNotifications  = ()     => api.get('/auth/notifications/')
export const markAllRead       = ()     => api.post('/auth/notifications/')
export const markOneRead       = (id)   => api.post(`/auth/notifications/${id}/read/`)
